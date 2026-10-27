# Country-based currency display

Implemented in the existing Expo SDK 57 app on 26 October 2026.

## Behavior and data preservation

- Open **Profile → Country & currency**. The same screen is reachable from Home's location sheet and monetary-screen currency notices.
- Automatic country selection follows the saved Home country, then the profile's country, then the device region. A manually chosen country for prices takes priority. Country codes come from the existing country list; 248 active tender mappings come from Unicode CLDR. India selects INR (₹), Pakistan selects PKR (₨), and USA selects USD ($). Antarctica has no assigned local currency; the screen explicitly offers a manual choice and labels USD as the fallback.
- A manual currency override persists independently of country. Clear it with **Use country currency**. Country, override and other existing preferences are saved together through the existing durable store; older saved records do not require a reset or destructive migration.
- Existing budgets, activity costs and curated sample prices were USD. Those values remain canonical USD. Display uses real USD exchange rates; changing preferences never rewrites saved amounts or replaces only their symbols. Newly entered local amounts are converted back to the same USD base. A focused input freezes its rate/currency, follows the device's numeric-input locale and keeps unchanged values at original precision.
- Displayed amounts use `Intl.NumberFormat` with the selected country and app language, including Indian grouping and currency-specific fraction digits. Currency codes accompany symbols to disambiguate dollar and rupee currencies. Converted values are marked approximate.
- Destination cards, recommendations, saved places, destination/experience details, budget filter choices and active limits, trip cards, trip details, activity/group totals, over-budget amounts, planner and discovery inputs use the shared conversion layer. Text summaries and calendar exports receive the same formatter. Importable JSON and collaboration records retain USD values so they cannot be interpreted in a recipient's different currency.

## Real integration and fallback

- [ExchangeRate-API open access endpoint](https://www.exchangerate-api.com/docs/free): `https://open.er-api.com/v6/latest/USD`. No API key or new backend is required. Visible attribution is provided beside converted prices and in currency settings.
- Only the constant USD base request is sent; personal budgets, trips and locations are not sent to this service. Responses are checked for a successful USD base, finite positive rates and valid provider timestamps. Simultaneous requests share one fetch. Successful fetches are limited to once an hour; normal fetches reuse rates until the provider's next daily update.
- Cached rates live under a separate device-only key and are excluded from backup/shared JSON. Saved rates can be used for seven days, with stale data labelled. Missing, malformed, unsupported or older rates show original explicitly labelled USD amounts while preserving the user's selection. Timeout, HTTP, connection and local-save errors remain explicit. This is an indicative planning conversion, not a payment quote.
- Country mappings and data provenance: [reference-data notes](../src/constants/data/README.md), [Unicode license](../src/constants/data/UNICODE-LICENSE.txt).

## Actual validation

| Check | Result |
| --- | --- |
| TypeScript | `npm run typecheck` passed |
| Lint | `npm run lint` passed |
| Automated tests | `npm test`: 97 passed, zero failures; 11 new currency tests |
| Production exports | Android, iOS and web exports passed |
| Real browser country switching | Selected India → INR, Pakistan → PKR and United States → USD; displayed values changed using actual fetched rates, not fixture rates |
| Manual override | Observed a GBP override retained while India was selected; selected an INR override independently of USA |
| Reload persistence | Reloaded settings and confirmed the selected USA country and USD currency remained |
| Existing amount precision | Created a $1,234.56 budget, switched to INR, viewed/focused its converted input and saved without editing, switched back to USA; the budget remained exactly $1,234.56 |
| Local-currency edit | Entered 20,000 INR in the existing trip budget, reviewed the planner total, saved and confirmed the trip detail showed approximately ₹20,000 INR |
| Shared UI | Observed INR destination prices, sample experiences, trip cards, trip totals and the converted planner input |
| Responsive rendering | Inspected final currency settings at 390- and 320-point browser widths; text wrapped and the 320-point document had no horizontal overflow |
| Missing/offline/error cases | Production-helper tests cover absent/expired/malformed/missing-currency rates, failed HTTP refresh with cache retention, corruption, deduplicated fetching and retry; no fixture rates are bundled in the app |
| Export/data invariants | Tests verify country/override backup round trips, unchanged legacy numeric values, unchanged importable trip amounts, and formatted text/calendar exports |

[Rendered currency settings](verification/currency-settings-390.png)

Browser checks used local preview records, including explicitly named currency QA trips. Existing Home, packing and route work was retained. Preview data may contain additional trips entered manually while the browser was being reviewed.

## Remaining limitations

- No physical iOS/Android device or simulator was available. Native numeric keyboards, Hermes locale coverage, screen readers, large system text and cold airplane-mode launch need device acceptance. Native exports do not prove those interactions.
- API outages and unavailable-rate cases were verified through controlled automated transport tests. A fresh offline installation has no rate and intentionally retains USD until a real rate is fetched. The live browser had a valid rate cache during review.
- Prices remain curated sample planning estimates; the currency update does not add booking, payments or guaranteed bank rates. Country tender mappings should be refreshed when currencies change. Provider availability and rate limits still apply.

