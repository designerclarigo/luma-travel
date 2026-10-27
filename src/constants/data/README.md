# Bundled geographic and climate references

Fetched for this implementation on 23 October 2026. Refresh with `node scripts/fetch-reference-data.cjs`; network failures remain visible and missing climate records are not replaced with defaults.

- `world.json`: simplified 1:110m country polygons, [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), public domain; official [source dataset](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson). 177 features. Tiny territories are represented in the searchable list, not fabricated as polygons.
- `countries.json`: 249 ISO country/territory names and codes from [datasets/country-list](https://github.com/datasets/country-list), CC0 data. This list is a journal index, not an assertion about political recognition.
- `climate.json`: monthly average daily low/high temperatures and average count of days with at least 1 mm precipitation from 1991–2020 ERA5 observations, via [Open-Meteo historical API](https://open-meteo.com/en/docs/historical-weather-api), [CC BY 4.0 attribution](https://open-meteo.com/en/terms). Each record includes its exact query, model, retrieval time and monthly observation counts. These are reanalysis averages, not daily forecasts. Bali/Denpasar, Braies and Santorini/Oia are verified; Kyoto and Malé requests were rate-limited and are omitted until a successful refresh.

No competitor graphics, screenshot layouts or brand assets are included. Destination photographs retain their existing source attribution in the app README.

## Country currencies

`country-currencies.json`: 248 country/territory default tender-currency mappings derived from [Unicode CLDR 48 currencyData](https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-core/supplemental/currencyData.json), effective 26 October 2026, including Bulgaria's EUR transition. Unicode data is covered by the [Unicode License v3](https://www.unicode.org/license.txt). Multiple-tender territories use the most recently introduced active tender; users may override it. Antarctica has no assigned local currency and requires an explicit currency choice. Regenerate with `scripts/update-country-currencies.cjs` using a downloaded CLDR source and effective date. This file contains currency codes only, never exchange rates.

Exchange rates are fetched from [ExchangeRate-API's open endpoint](https://www.exchangerate-api.com/docs/free), cached only on the device and attributed wherever converted prices appear. They are not bundled or included in backups/shared JSON. Display conversions are indicative planning estimates. Amounts in existing/importable trip records and sample destination data remain in USD.
