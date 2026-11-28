#!/usr/bin/env python3
"""Publie un dossier de JSON dans le bucket R2 « radar-plus-data », fichiers
modifiés seulement.

Usage :
    python3 pipeline/publish_r2.py <dossier_source> [--prefix v2] [--dry-run]

Compare le MD5 local à l'ETag distant (égal au MD5 pour un envoi simple) et
n'envoie que ce qui diffère. Les clés distantes absentes du dossier ne sont
JAMAIS supprimées (les jours anciens restent servis).

Variables d'environnement :
    CLOUDFLARE_ACCOUNT_ID   compte Cloudflare (endpoint S3 de R2)
    CLOUDFLARE_API_TOKEN    (optionnel) jeton avec « Cache Purge » sur la zone radarplus.org
    CLOUDFLARE_ZONE_ID      (optionnel) zone radarplus.org ; avec le jeton, vide le cache
                            de chaque fichier envoyé (échec = sortie en erreur)
    R2_PUBLIC_BASE          (défaut : https://data.radarplus.org)
    R2_ACCESS_KEY_ID        jeton R2 « Object Read & Write » sur le bucket
    R2_SECRET_ACCESS_KEY
    R2_BUCKET               (défaut : radar-plus-data)

Cache Cloudflare (27 nov. 2026) : les fichiers v2/ sont gardés 4 h en bordure (règle de
cache de la zone) ; ce script vide le cache des fichiers qu'il vient d'envoyer, pour
qu'aucun visiteur ne voie une version périmée.

Cache-Control par préfixe : les fichiers « vivants » (index, agrégats du mois
courant, ticker) 60 s ; les fichiers de jour (immuables une fois le jour
passé) 300 s. Tout est public via data.radarplus.org.
"""
import argparse
import hashlib
import json
import urllib.error
import urllib.request
import mimetypes
import os
import sys
from pathlib import Path

import boto3
from botocore.config import Config


def md5_of(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def cache_control_for(key: str) -> str:
    if key.endswith("index.json") or key.startswith("ticker") or "/agg/" in key:
        return "public, max-age=60"
    return "public, max-age=300"


def purge_cache(urls: list[str]) -> None:
    """Vide le cache Cloudflare de ces adresses (30 par appel). Lève une erreur si un appel échoue."""
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    zone = os.environ.get("CLOUDFLARE_ZONE_ID")
    if not (token and zone):
        print("::warning::CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID absents : cache non vidé")
        return
    api = f"https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache"
    for i in range(0, len(urls), 30):
        batch = urls[i:i + 30]
        req = urllib.request.Request(
            api, data=json.dumps({"files": batch}).encode(), method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = json.load(r)
        except urllib.error.HTTPError as e:
            body = {"success": False, "errors": e.read().decode(errors="replace")[:500]}
        if not body.get("success"):
            raise RuntimeError(f"vidage du cache refusé : {body.get('errors')}")
    print(f"✓ cache vidé pour {len(urls)} fichiers")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source", help="dossier local à publier")
    ap.add_argument("--prefix", default="", help="préfixe distant (ex. v2)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    src = Path(args.source)
    if not src.is_dir():
        sys.exit(f"dossier introuvable : {src}")

    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    key_id = os.environ.get("R2_ACCESS_KEY_ID")
    secret = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket = os.environ.get("R2_BUCKET", "radar-plus-data")
    if not (account and key_id and secret):
        sys.exit("CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID et R2_SECRET_ACCESS_KEY sont requis")

    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"}),
    )

    prefix = args.prefix.strip("/")
    prefix = prefix + "/" if prefix else ""

    # ETags distants (MD5 pour les envois simples) sous le préfixe.
    remote: dict[str, str] = {}
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            remote[obj["Key"]] = obj["ETag"].strip('"')

    local_files = sorted(p for p in src.rglob("*") if p.is_file() and not p.name.startswith("."))
    to_send, unchanged = [], 0
    for p in local_files:
        key = prefix + p.relative_to(src).as_posix()
        if remote.get(key) == md5_of(p):
            unchanged += 1
        else:
            to_send.append((p, key))

    print(f"{len(local_files)} fichiers locaux, {unchanged} inchangés, {len(to_send)} à envoyer"
          f" (bucket {bucket}, préfixe « {prefix or '/'} »)")
    if args.dry_run:
        for _, key in to_send[:50]:
            print("  →", key)
        return 0

    for p, key in to_send:
        ctype = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
        if p.suffix == ".json":
            ctype = "application/json"
        s3.upload_file(
            str(p), bucket, key,
            ExtraArgs={"ContentType": ctype, "CacheControl": cache_control_for(key)},
        )
    print(f"✓ {len(to_send)} fichiers publiés")
    if to_send:
        public = os.environ.get("R2_PUBLIC_BASE", "https://data.radarplus.org").rstrip("/")
        try:
            purge_cache([f"{public}/{key}" for _, key in to_send])
        except Exception as e:  # noqa: BLE001 — tout échec doit faire échouer le refresh
            print(f"::error::{e}")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
