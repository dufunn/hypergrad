# Contributing to HyperGrad

Thanks for helping make campus recruiting less fragmented.

## Before opening a change

1. Search existing issues and pull requests.
2. Keep changes focused on one product or engineering problem.
3. Do not include real applicant data, private recruitment pages, credentials, or copied job descriptions.
4. Confirm that any new visual asset, dataset, or component can be redistributed and add it to `THIRD_PARTY_NOTICES.md` when needed.

## Local workflow

```bash
python3 server.py --open
npm run check
```

Cloud configuration is optional. Copy the `*.example.js` files to their ignored `*.local.js` counterparts when testing integrations.

## Pull requests

- Explain the user problem and the chosen behavior.
- Include before/after screenshots for interface changes.
- Add or update tests for parsers, migrations, and data transformations.
- Preserve keyboard focus, reduced-motion behavior, mobile layout, and empty states.
- Keep third-party service calls user-initiated; HyperGrad is not intended for bulk scraping.

## Database changes

Add a timestamped migration under `supabase/migrations/`. Apply least-privilege grants and Row Level Security, and document any required dashboard configuration in `DEPLOY.md`.

## Commit style

Use a short, imperative summary, for example `add demo sandbox` or `fix Moka Base parsing`.
