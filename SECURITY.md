# Security policy

## Supported version

Security fixes are applied to the latest commit on `main` and the current production deployment.

## Reporting a vulnerability

Please do not open a public issue for authentication, authorization, privacy, SSRF, credential, or data-exposure concerns.

Use GitHub's **Report a vulnerability** flow in the repository Security tab. Include:

- the affected page, function, or database policy;
- a minimal reproduction;
- the impact you observed;
- any suggested mitigation;
- whether production data may be involved.

You should receive an initial response within seven days. Please allow time for a fix before publishing details.

## Secrets

HyperGrad's browser configuration accepts only public/client-safe keys:

- Supabase publishable or anon key;
- AMap Web JS API key and its browser security code.

Never commit a Supabase `service_role` key, Vercel token, database password, private map service credential, exported user data, or production `.env` file.

If a secret is committed, revoke or rotate it first; removing the line in a later commit is not sufficient because Git history remains accessible.

## Hosted deployment hardening

- Keep the Edge Function JWT verification enabled.
- Set `ALLOWED_ORIGINS` for JD Capture. Its built-in rate limit is best-effort and should be supplemented at the gateway for high-traffic deployments.
- Apply every Supabase migration and keep Row Level Security enabled.
