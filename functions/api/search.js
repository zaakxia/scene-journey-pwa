// Cloudflare Pages Function — Nominatim search proxy
// Routes: /api/search?q=<query>
// Runs on CF edge (outside China) → accesses Nominatim without GFW blocking

// Simple in-memory rate limiter (per instance, good enough for low traffic)
var lastRequestTime = 0;
var MIN_INTERVAL = 1100; // 1.1s between requests (Nominatim allows 1 req/s)

export async function onRequest(context) {
  var url = new URL(context.request.url);
  var query = url.searchParams.get('q');
  if (!query || query.length < 2) {
    return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Rate limit: enforce 1.1s between requests
  var now = Date.now();
  var wait = lastRequestTime + MIN_INTERVAL - now;
  if (wait > 0) { await new Promise(function(r) { setTimeout(r, wait); }); }
  lastRequestTime = Date.now();

  try {
    var nomUrl = 'https://nominatim.openstreetmap.org/search?q=' +
      encodeURIComponent(query) + '&format=json&limit=5&accept-language=zh';
    var resp = await fetch(nomUrl, {
      headers: { 'User-Agent': 'scene-journey-pwa/1.0 (Cloudflare Pages Function)' }
    });
    var data = await resp.json();
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=30'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Search failed', detail: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
