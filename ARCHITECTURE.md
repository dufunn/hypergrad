# Architecture notes

## Frontend

HyperGrad is a static, framework-free web application. `index.html` defines product surfaces, `workspace.css` contains the current design system, and `app.js` coordinates state, rendering, maps, authentication, and integrations.

The current single-file frontend reflects the product-prototyping history. Planned module boundaries are:

- `auth` — sessions, invite signup, recovery, administrator capability;
- `jobs` — record schema, editing, duplicate detection, backup/restore;
- `schedule` — objective deadline and interview events;
- `analytics` — pipeline, role direction, conversion, and city signals;
- `maps` — overview choropleth, office markers, clustering, routes;
- `friends` — privacy-trimmed sharing and subscriptions;
- `job-import` — client invocation and result review.

## Storage modes

| Mode | Persistence | Intended use |
| --- | --- | --- |
| Demo sandbox | None | Portfolio review and product exploration |
| Local workspace | Browser storage | Offline-first personal use without Supabase |
| Cloud workspace | Supabase PostgreSQL + browser cache | Authenticated cross-device use |

Demo mode is intentionally isolated in memory. Editing is allowed so reviewers can explore the full interaction model, but changes disappear on exit or refresh.

## Cloud boundary

Supabase provides authentication, database transactions, Row Level Security, invite enforcement, friend-space privacy trimming, usage telemetry, and the JD Capture Edge Function. The browser uses only a publishable/anon key.

## External integrations

- AMap provides optional POI search and transit/driving routes.
- OpenStreetMap, MapLibre, and Leaflet provide fallback maps and rendering.
- JD Capture fetches one user-supplied public recruitment page at a time.

Every external result is treated as advisory. Users confirm office points and imported fields before saving.
