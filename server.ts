/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

let aiClient: GoogleGenAI | null = null;

// Lazy initialization of Gemini client to prevent crash on startup if key is missing
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not defined. Please set it in your .env file.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'k-sound-galaxy',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const HMR_PORT = Number(process.env.HMR_PORT) || PORT + 1;

  // Middleware
  app.use(express.json());

  // === API ROUTES ===

  // Connection analysis endpoint
  app.post('/api/gemini/analyze-connection', async (req, res) => {
    try {
      const { nodeA, nodeB } = req.body;

      if (!nodeA || !nodeB) {
        return res.status(400).json({ error: 'nodeA and nodeB are required parameters.' });
      }

      // Format clean prompts explaining the connection
      const prompt = `Analyze the musical, cultural, stylistic, or conceptual connection between two music entities:
Entity A: "${nodeA.name}" (${nodeA.type}${nodeA.genre ? `, Genre: ${nodeA.genre}` : ''}${nodeA.region ? `, Region: ${nodeA.region}` : ''}${nodeA.label ? `, Label/Agency: ${nodeA.label}` : ''})
Entity B: "${nodeB.name}" (${nodeB.type}${nodeB.genre ? `, Genre: ${nodeB.genre}` : ''}${nodeB.region ? `, Region: ${nodeB.region}` : ''}${nodeB.label ? `, Label/Agency: ${nodeB.label}` : ''})

Provide:
1. "explanation": A highly poetic and professional 2-3 sentence analysis of their connection, structural similarities, contrast, or cultural dialogue. Draw connections between regions (e.g. how K-pop references Western R&B, or Mandopop fuses classical melodies with modern grooves).
2. "sharedDNA": An array of 3 core aesthetic keywords or tags that represent their shared music DNA (e.g. ["Syncopated Beats", "Melancholic Harmony", "Glitch Aesthetics"]).
3. "similarityScore": An integer from 10 to 100 representing how closely they are linked in the cosmic music ecosystem.

Respond strictly in JSON format matching the schema.`;

      try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                explanation: { type: Type.STRING },
                sharedDNA: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                similarityScore: { type: Type.INTEGER },
              },
              required: ['explanation', 'sharedDNA', 'similarityScore'],
            },
          },
        });

        const text = response.text;
        if (!text) {
          throw new Error('Empty response from Gemini API.');
        }

        const data = JSON.parse(text.trim());
        return res.json(data);

      } catch (geminiError: any) {
        console.warn('Gemini API call failed, falling back to local heuristic rules:', geminiError.message);
        
        // Dynamic offline fallback matching their types to provide high-quality experience even without key
        const score = Math.floor(Math.random() * 40) + 40;
        let explanation = `The cosmic alignment between ${nodeA.name} and ${nodeB.name} bridges unique musical wavelengths, showcasing structural harmonies and rhythmic connections.`;
        let sharedDNA = ['Stellar Frequency', 'Acoustic Orbit', 'Cosmic Vibe'];

        if (nodeA.type === 'song' && nodeB.type === 'song') {
          explanation = `Both tracks echo shared harmonic blueprints. "${nodeA.name}" and "${nodeB.name}" create an evocative bridge between genres, utilizing balanced syncopation and ambient textures to capture listeners.`;
          sharedDNA = [nodeA.mood || 'Vibrant', nodeB.mood || 'Dynamic', 'Vocal Layering'];
        } else if (nodeA.type === 'artist' || nodeB.type === 'artist') {
          explanation = `${nodeA.name} and ${nodeB.name} occupy distinct orbits in the musical galaxy, but are connected through their innovative production choices and distinct artistic voices.`;
          sharedDNA = ['Creative Vision', 'Boundary Pushing', 'Signature Style'];
        }

        return res.json({
          explanation,
          sharedDNA,
          similarityScore: score,
          offline: true,
          errorMessage: geminiError.message.includes('GEMINI_API_KEY') ? 'Configuration key missing. Set GEMINI_API_KEY in your .env file. Using simulated galactic analysis.' : undefined
        });
      }

    } catch (err: any) {
      console.error('Server connection analysis error:', err);
      res.status(500).json({ error: 'Internal server error during music analysis.' });
    }
  });

  // === iTunes proxy (cover art + 30s previews, avoids browser CORS) ===

  // Search a track: /api/itunes/search?term=Seven%20Jungkook
  const itunesCache = new Map<string, any>();
  app.get('/api/itunes/search', async (req, res) => {
    try {
      const term = String(req.query.term || '').trim();
      if (!term) return res.status(400).json({ error: 'term is required' });

      if (itunesCache.has(term)) return res.json(itunesCache.get(term));

      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=US&media=music&entity=song&limit=25`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`iTunes responded ${resp.status}`);
      const data: any = await resp.json();

      const results = (data.results || []).map((r: any) => ({
        trackName: r.trackName,
        artistName: r.artistName,
        collectionName: r.collectionName,
        // upscale the 100x100 artwork to high resolution
        artworkUrl: r.artworkUrl100 ? String(r.artworkUrl100).replace('100x100bb', '1000x1000bb') : null,
        artworkUrlSmall: r.artworkUrl100 ? String(r.artworkUrl100).replace('100x100bb', '200x200bb') : null,
        previewUrl: r.previewUrl || null,
        trackTimeMillis: r.trackTimeMillis,
      }));

      const payload = { results };
      itunesCache.set(term, payload);
      res.json(payload);
    } catch (err: any) {
      console.error('iTunes search error:', err.message);
      res.status(502).json({ error: 'iTunes search failed', detail: err.message });
    }
  });

  // Binary proxy so textures/audio load without CORS headaches.
  // Only allow Apple CDN hosts to avoid becoming an open proxy.
  const hostAllowed = (remoteUrl: string) => {
    const parsed = new URL(remoteUrl);
    return /(\.mzstatic\.com|\.apple\.com)$/i.test(parsed.hostname);
  };

  // Upstream fetch with timeout + retries — Apple's CDN occasionally hiccups
  // and a single failed request must never leave the UI without a cover.
  const fetchUpstream = async (url: string, tries = 3, timeoutMs = 12000) => {
    let lastErr: any = null;
    for (let i = 0; i < tries; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const resp = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (resp.ok && resp.body) return resp;
        lastErr = new Error(`upstream ${resp.status}`);
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
      }
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
    throw lastErr;
  };

  // Artwork: buffer whole images and cache them in memory — after the first
  // successful fetch a cover is served instantly and can no longer fail.
  const artworkCache = new Map<string, { type: string; data: Buffer }>();
  const ARTWORK_CACHE_MAX = 300;

  app.get('/api/itunes/artwork', async (req, res) => {
    const url = String(req.query.url || '');
    try {
      if (!hostAllowed(url)) return res.status(403).json({ error: 'host not allowed' });
      const hit = artworkCache.get(url);
      if (hit) {
        res.setHeader('Content-Type', hit.type);
        res.setHeader('Cache-Control', 'public, max-age=604800');
        return res.end(hit.data);
      }
      const resp = await fetchUpstream(url);
      const data = Buffer.from(await resp.arrayBuffer());
      const type = resp.headers.get('content-type') || 'image/jpeg';
      artworkCache.set(url, { type, data });
      if (artworkCache.size > ARTWORK_CACHE_MAX) {
        const oldest = artworkCache.keys().next().value;
        if (oldest) artworkCache.delete(oldest);
      }
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.end(data);
    } catch (err: any) {
      console.error('artwork proxy error:', err.message);
      if (!res.headersSent) res.status(502).json({ error: err.message });
      else res.destroy();
    }
  });

  // Audio: stream previews, with the same retry on connect and a clean socket
  // teardown if the upstream breaks mid-flight (so the client can retry
  // instead of hanging on a half-finished response).
  app.get('/api/itunes/audio', async (req, res) => {
    const url = String(req.query.url || '');
    try {
      if (!hostAllowed(url)) return res.status(403).json({ error: 'host not allowed' });
      const resp = await fetchUpstream(url);
      res.setHeader('Content-Type', resp.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const reader = resp.body!.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (err: any) {
      console.error('audio proxy error:', err.message);
      if (!res.headersSent) res.status(502).json({ error: err.message });
      else res.destroy();
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // === VITE / STATIC ROUTING ===
  if (process.env.NODE_ENV !== 'production') {
    console.log('Running in DEVELOPMENT mode, mounting Vite middleware...');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: HMR_PORT },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Running in PRODUCTION mode, serving static files...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`K Sound Galaxy server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start K Sound Galaxy server:', err);
  process.exit(1);
});
