// Input: Unicode CLDR supplemental/currencyData.json downloaded from
// https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/currencyData.json
// Usage: node scripts/update-country-currencies.cjs <input.json> <YYYY-MM-DD>
const fs = require('node:fs');
const countries = require('../src/constants/data/countries.json');
const [file, date] = process.argv.slice(2);
if (!file || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Supply a CLDR currencyData file and effective date.');
const { currencyData } = JSON.parse(fs.readFileSync(file, 'utf8')).supplemental;
const result = {};
for (const { code } of countries) {
  const candidates = (currencyData.region[code] ?? []).flatMap((row) => Object.entries(row)
    .filter(([, v]) => v._tender !== 'false' && (!v._from || v._from <= date) && (!v._to || v._to >= date)))
    .sort((a, b) => (b[1]._from ?? '').localeCompare(a[1]._from ?? ''));
  if (candidates.length) result[code] = candidates[0][0];
}
fs.writeFileSync('src/constants/data/country-currencies.json', JSON.stringify(result, null, 2) + '\n');
console.log(`${Object.keys(result).length} country mappings effective ${date}. India=${result.IN}, Pakistan=${result.PK}, USA=${result.US}, Bulgaria=${result.BG}.`);
