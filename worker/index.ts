interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const APPLE_HOST = /(?:\.mzstatic\.com|\.apple\.com)$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function isAppleMediaUrl(value: string) {
  try {
    return APPLE_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

async function fetchWithRetry(url: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok && response.body) return response;
      lastError = new Error(`upstream ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function proxyAppleMedia(request: Request, cacheSeconds: number) {
  const url = new URL(request.url).searchParams.get('url') || '';
  if (!isAppleMediaUrl(url)) return json({ error: 'host not allowed' }, 403);
  try {
    const upstream = await fetchWithRetry(url);
    const headers = new Headers();
    headers.set('content-type', upstream.headers.get('content-type') || 'application/octet-stream');
    headers.set('cache-control', `public, max-age=${cacheSeconds}`);
    return new Response(upstream.body, { headers });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'upstream request failed' }, 502);
  }
}

async function searchITunes(request: Request) {
  const term = new URL(request.url).searchParams.get('term')?.trim() || '';
  if (!term) return json({ error: 'term is required' }, 400);
  try {
    const upstream = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=US&media=music&entity=song&limit=25`);
    if (!upstream.ok) throw new Error(`iTunes responded ${upstream.status}`);
    const data = await upstream.json() as { results?: Array<Record<string, unknown>> };
    const results = (data.results || []).map((track) => {
      const cover = typeof track.artworkUrl100 === 'string' ? track.artworkUrl100 : null;
      return {
        trackName: track.trackName,
        artistName: track.artistName,
        collectionName: track.collectionName,
        artworkUrl: cover?.replace('100x100bb', '1000x1000bb') || null,
        artworkUrlSmall: cover?.replace('100x100bb', '200x200bb') || null,
        previewUrl: track.previewUrl || null,
        trackTimeMillis: track.trackTimeMillis,
      };
    });
    return json({ results });
  } catch (error) {
    return json({ error: 'iTunes search failed', detail: error instanceof Error ? error.message : String(error) }, 502);
  }
}

function connectionFallback(request: Request) {
  return request.json().then((body: { nodeA?: Record<string, string>; nodeB?: Record<string, string> }) => {
    const nodeA = body.nodeA;
    const nodeB = body.nodeB;
    if (!nodeA || !nodeB) return json({ error: 'nodeA and nodeB are required parameters.' }, 400);
    return json({
      explanation: `${nodeA.name || 'Entity A'} and ${nodeB.name || 'Entity B'} occupy distinct orbits in the musical galaxy, connected through their creative choices and artistic voices.`,
      sharedDNA: ['Creative Vision', 'Boundary Pushing', 'Signature Style'],
      similarityScore: 65,
      offline: true,
    });
  }).catch(() => json({ error: 'invalid JSON body' }, 400));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ status: 'ok', time: new Date().toISOString() });
    if (url.pathname === '/api/itunes/search') return searchITunes(request);
    if (url.pathname === '/api/itunes/artwork') return proxyAppleMedia(request, 604800);
    if (url.pathname === '/api/itunes/audio') return proxyAppleMedia(request, 86400);
    if (url.pathname === '/api/gemini/analyze-connection' && request.method === 'POST') return connectionFallback(request);

    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404 || request.method !== 'GET' || url.pathname.includes('.')) return asset;
    return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
  },
};
