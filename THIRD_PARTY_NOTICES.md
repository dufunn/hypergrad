# Third-party notices

The MIT License in this repository covers original HyperGrad source code only. The following services, datasets, fonts, and media retain their own licenses and terms.

## Runtime libraries

- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) — BSD 3-Clause License.
- [Leaflet](https://github.com/Leaflet/Leaflet) — BSD 2-Clause License.
- [Supabase JavaScript client](https://github.com/supabase/supabase-js) — MIT License.

They are loaded from public CDNs in the reference frontend and are not vendored into this repository.

## Maps and geographic data

- [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors — map data under the Open Database License; attribution must remain visible where the map is rendered.
- [Map tiles by MeMoMaps](https://memomaps.de/) — subject to the provider's tile usage terms and OpenStreetMap attribution requirements.
- [AMap / 高德开放平台](https://lbs.amap.com/) — optional proprietary API. Every deployment must use its own Web JS key, security code, domain allowlist, quota, and applicable service terms.
- China administrative boundary GeoJSON is adapted from [geoBoundaries](https://www.geoboundaries.org/) `gbOpen` CHN ADM0/ADM1 (2019), build `9469f09`. The source metadata identifies the underlying layers as Public Domain; geoBoundaries asks for attribution. See `scripts/prepare-boundaries.mjs` for the deterministic name and centroid normalization used by HyperGrad.

Geographic boundaries and labels are for product visualization only and must not be treated as an authoritative legal or surveying source.

## Fonts

- Manrope — SIL Open Font License 1.1.
- Pixelify Sans — SIL Open Font License 1.1.

The reference frontend loads both families from Google Fonts.

## Landing media

The landing-page desert footage is based on Pexels video asset `14483416` and is used under the [Pexels License](https://www.pexels.com/license/). The repository contains optimized 1080p and 720p derivatives plus a poster frame. Downstream users should re-check the source license before redistributing media assets.

## Recruitment pages

JD Capture reads individual, user-supplied public recruitment links. Job descriptions, company marks, and recruitment-page content remain the property of their respective owners. HyperGrad does not bundle captured JDs, is not affiliated with the referenced employers or applicant-tracking-system providers, and is not intended for bulk crawling.

## Design references

The interface was developed through iterative product design and visual research. Examples on 21st.dev and other public galleries informed some visualization and layout exploration; no 21st.dev package is included as a runtime dependency. Contributors must verify a component's own license before copying third-party source.
