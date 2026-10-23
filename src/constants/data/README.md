# Bundled geographic and climate references

Fetched for this implementation on 23 October 2026. Refresh with `node scripts/fetch-reference-data.cjs`; network failures remain visible and missing climate records are not replaced with defaults.

- `world.json`: simplified 1:110m country polygons, [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), public domain; official [source dataset](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson). 177 features. Tiny territories are represented in the searchable list, not fabricated as polygons.
- `countries.json`: 249 ISO country/territory names and codes from [datasets/country-list](https://github.com/datasets/country-list), CC0 data. This list is a journal index, not an assertion about political recognition.
- `climate.json`: monthly average daily low/high temperatures and average count of days with at least 1 mm precipitation from 1991–2020 ERA5 observations, via [Open-Meteo historical API](https://open-meteo.com/en/docs/historical-weather-api), [CC BY 4.0 attribution](https://open-meteo.com/en/terms). Each record includes its exact query, model, retrieval time and monthly observation counts. These are reanalysis averages, not daily forecasts. Bali/Denpasar, Braies and Santorini/Oia are verified; Kyoto and Malé requests were rate-limited and are omitted until a successful refresh.

No competitor graphics, screenshot layouts or brand assets are included. Destination photographs retain their existing source attribution in the app README.
