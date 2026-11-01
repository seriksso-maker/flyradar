// Flyradar-proxy for Cloudflare Workers (gratis). Legger på CORS og slår sammen flere sirkler i ett kall.
// Bruk: https://DITT-NAVN.workers.dev/multi?p=lat,lon,nm|lat,lon,nm   (nm = nautiske mil, maks 250)
const SOURCES = [
  (la, lo, r) => `https://api.adsb.lol/v2/point/${la}/${lo}/${r}`,
  (la, lo, r) => `https://api.airplanes.live/v2/point/${la}/${lo}/${r}`,
  (la, lo, r) => `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${r}`,
  (la, lo, r) => `https://api.adsb.one/v2/point/${la}/${lo}/${r}`,
];
const CORS = { 'Access-Control-Allow-Origin': '*' };
const num = (x) => /^-?\d+(\.\d+)?$/.test(x);

async function fetchPoint(la, lo, r) {
  for (const mk of SOURCES) {
    try {
      const res = await fetch(mk(la, lo, r), {
        headers: { 'User-Agent': 'flyradar-worker/1.0' },
        cf: { cacheTtl: 3, cacheEverything: true },
      });
      if (!res.ok) continue;
      const j = await res.json();
      return j.ac || j.aircraft || [];
    } catch (e) { /* prøv neste kilde */ }
  }
  return null;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' } });
    }
    const url = new URL(request.url);
    if (url.pathname !== '/multi') {
      return new Response('Flyradar-proxy er i gang. Bruk /multi?p=lat,lon,nm', { headers: CORS });
    }
    const pts = (url.searchParams.get('p') || '').split('|').slice(0, 12)
      .map((s) => s.split(','))
      .filter((a) => a.length === 3 && a.every(num))
      .map(([la, lo, r]) => [la, lo, Math.min(250, Math.max(1, Math.round(+r)))]);
    if (!pts.length) {
      return new Response(JSON.stringify({ error: 'ingen punkter' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    const results = await Promise.all(pts.map(([la, lo, r]) => fetchPoint(la, lo, r)));
    const ok = results.filter((x) => x !== null);
    if (!ok.length) {
      return new Response(JSON.stringify({ error: 'alle kilder feilet' }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    const byHex = {};
    for (const list of ok) for (const a of list) if (a.hex) byHex[a.hex] = a;
    return new Response(JSON.stringify({ ac: Object.values(byHex), partial: ok.length < pts.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3' },
    });
  },
};
