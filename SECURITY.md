# Security Policy

## Supported scope

This repository is actively maintained.

## Reporting a vulnerability

Please do not open a public issue for security vulnerabilities.

Use one of these channels:

- GitHub private vulnerability reporting (preferred)
- Direct contact with the maintainer: @AdriClout

When reporting, include:

- a short description of the issue
- impact and affected files/workflows
- reproducible steps or proof of concept
- mitigation ideas if available

## Response targets

- Initial acknowledgement: within 72 hours
- Triage decision: within 7 days
- Fix timeline: depends on severity and operational impact

## Disclosure

We follow coordinated disclosure:

1. Receive and validate report
2. Prepare and test fix
3. Deploy fix
4. Publish summary and mitigation notes when appropriate

## Operational notes

- `main` is protected by PR rules.
- Scheduled automation uses dedicated credentials and least required permissions.
- Avoid storing secrets or raw media dumps in the repository.
