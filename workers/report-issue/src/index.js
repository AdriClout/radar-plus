/**
 * Worker proxy de signalement RADAR+ — remplace l'ancien mécanisme qui
 * publiait un token GitHub en clair dans shared-menu.js (faille corrigée le
 * 2026-08-30). Modèle : le worker report-issue de La Vitrine démocratique.
 *
 * Le navigateur poste le signalement ici sans aucun secret ; le worker
 * valide, limite le débit, puis déclenche le repository_dispatch GitHub
 * avec un token gardé côté serveur (wrangler secret put GITHUB_TOKEN —
 * token fine-grained, portée « contents: read/write » sur radar-plus
 * uniquement).
 *
 * Déploiement : cd workers/report-issue && npx wrangler deploy
 * Puis reporter l'URL du worker dans REPORT_PROXY_URL de
 * site/assets/js/shared-menu.js.
 */

const ALLOWED_ORIGINS = new Set([
  'https://radarplus.org',
  'https://www.radarplus.org',
  'http://localhost:8000',
]);
// Les Deploy Previews Netlify (deploy-preview-N--fabulous-strudel-030ed5.netlify.app)
const PREVIEW_ORIGIN = /^https:\/\/deploy-preview-\d+--fabulous-strudel-030ed5\.netlify\.app$/;

const REPO = 'AdriClout/radar-plus';
const EVENT_TYPE = 'radar-report-issue';
const MAX_BODY_BYTES = 60_000;      // le repository_dispatch plafonne à ~65 Ko
const RATE_LIMIT_PER_HOUR = 5;      // par adresse IP

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function originAllowed(origin) {
  return ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin || '');
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

const clean = (v, max) => String(v ?? '').slice(0, max);

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    if (!originAllowed(origin)) return json(403, { error: 'origin' });
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json(405, { error: 'method' }, cors);

    // Limite de débit par IP via le cache du POP (approximative mais
    // suffisante pour empêcher le spam d'issues — l'ancien vecteur).
    const ip = request.headers.get('CF-Connecting-IP') || 'anonyme';
    const hour = Math.floor(Date.now() / 3_600_000);
    const gateUrl = `https://rate.radarplus.invalid/${ip}/${hour}`;
    const cache = caches.default;
    const seen = await cache.match(gateUrl);
    const count = seen ? Number(await seen.text()) || 0 : 0;
    if (count >= RATE_LIMIT_PER_HOUR) return json(429, { error: 'rate' }, cors);
    ctx.waitUntil(cache.put(gateUrl, new Response(String(count + 1), {
      headers: { 'Cache-Control': 'max-age=3600' },
    })));

    let payload;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'size' }, cors);
      payload = JSON.parse(raw);
    } catch {
      return json(400, { error: 'json' }, cors);
    }

    const cp = payload?.client_payload || {};
    const description = clean(cp.description, 4000).trim();
    if (!description) return json(400, { error: 'empty' }, cors);

    const dispatch = {
      event_type: EVENT_TYPE,
      client_payload: {
        description,
        reporter_name: clean(cp.reporter_name, 200),
        section: clean(cp.section, 200),
        element_context: clean(cp.element_context, 500),
        page: clean(cp.page, 300),
        url: clean(cp.url, 500),
        language: clean(cp.language, 10),
        user_agent: clean(cp.user_agent, 300),
        submitted_at: new Date().toISOString(),
      },
    };

    const gh = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'radarplus-report-worker',
      },
      body: JSON.stringify(dispatch),
    });

    if (!gh.ok) return json(502, { error: 'github', status: gh.status }, cors);
    return json(200, { ok: true }, cors);
  },
};
