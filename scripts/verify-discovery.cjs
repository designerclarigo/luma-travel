// Read-only public sample queries. This is opt-in network verification, not a mocked test.
const query = '[out:json][timeout:20];nwr(around:2000,38.7223,-9.1393)[amenity="cafe"][name];out center 40;';
async function main() {
  for (const method of ['GET', 'POST']) {
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter' + (method === 'GET' ? '?data=' + encodeURIComponent(query) : ''), { method, headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}, ...(method === 'POST' ? { body: new URLSearchParams({ data: query }).toString() } : {}), signal: AbortSignal.timeout(25000) });
      const body = await response.text(); let count; try { count = JSON.parse(body).elements?.length; } catch { /* Report the provider's actual error. */ }
      console.log(JSON.stringify({ method, status: response.status, count, ...(response.ok ? {} : { error: body.slice(0, 350) }) }));
    } catch (error) { console.log(JSON.stringify({ method, error: error.message })); }
  }
}
main();
