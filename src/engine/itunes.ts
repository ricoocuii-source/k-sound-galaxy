/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * iTunes track lookup through the local server proxy (no browser CORS).
 * Returns proxied URLs so textures/audio load as same-origin resources.
 */

import { MusicNode } from '../types';

export interface TrackInfo {
  trackName: string;
  artistName: string;
  collectionName: string;
  /** proxied 1000x1000 artwork url (same-origin) */
  artworkUrl: string | null;
  /** proxied 200x200 artwork url (same-origin) */
  artworkUrlSmall: string | null;
  /** proxied 30s preview audio url (same-origin) */
  previewUrl: string | null;
}

const cache = new Map<string, TrackInfo | null>();

const proxied = (kind: 'artwork' | 'audio', url: string | null): string | null =>
  url ? `/api/itunes/${kind}?url=${encodeURIComponent(url)}` : null;

// Diacritics-folding normalizer (ROSÉ → rose); keeps CJK/Hangul.
const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const normTitle = (s: string) =>
  fold(s)
    .replace(/[\(\[][^)\]]*[\)\]]/g, ' ')
    .replace(/[^a-z0-9가-힣一-鿿]+/g, '');
const normLoose = (s: string) => fold(s).replace(/[^a-z0-9가-힣一-鿿]+/g, '');

export function searchTermForNode(node: MusicNode): string {
  const primaryArtist =
    node.searchArtist || (node.artist ? node.artist.split('/')[0].trim() : '');
  return `${node.name} ${primaryArtist}`.trim();
}

export async function fetchTrackInfo(node: MusicNode): Promise<TrackInfo | null> {
  const term = searchTermForNode(node);
  if (cache.has(term)) return cache.get(term)!;

  try {
    // Small retry loop — a transient failure here would otherwise cost the
    // whole selection its cover art AND preview audio.
    let data: any = null;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(`/api/itunes/search?term=${encodeURIComponent(term)}`);
        if (!res.ok) throw new Error(`search ${res.status}`);
        data = await res.json();
        break;
      } catch (err) {
        if (attempt >= 2) throw err;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    const results: any[] = data.results || [];

    // Accept a result only if (a) it has a preview, (b) the track name matches,
    // and (c) the recording is credited to this artist (or an official alias /
    // a collab where the track title feat-credits them). Never fall back to an
    // unrelated same-title recording (covers, karaoke, other artists).
    const wanted = normTitle(node.name);
    const primaryArtist = node.artist ? node.artist.split('/')[0].trim() : '';
    const aliases = (node.itunesArtists && node.itunesArtists.length
      ? node.itunesArtists
      : [node.searchArtist || primaryArtist]
    ).map(normLoose);

    const best = results.find((r) => {
      if (!r.previewUrl) return false;
      const got = normTitle(String(r.trackName || ''));
      const titleOk =
        got === wanted ||
        got.startsWith(wanted) ||
        wanted.startsWith(got) ||
        (wanted.length >= 8 && got.includes(wanted));
      if (!titleOk) return false;
      // Artist must match an official credit — checking the title for artist
      // mentions is NOT safe (karaoke covers write "Originally Performed by X").
      const by = normLoose(String(r.artistName || ''));
      return aliases.some((a) => a && (by.includes(a) || a.includes(by)));
    });

    if (!best) {
      cache.set(term, null);
      return null;
    }

    const info: TrackInfo = {
      trackName: best.trackName,
      artistName: best.artistName,
      collectionName: best.collectionName,
      artworkUrl: proxied('artwork', best.artworkUrl),
      artworkUrlSmall: proxied('artwork', best.artworkUrlSmall),
      previewUrl: proxied('audio', best.previewUrl),
    };
    cache.set(term, info);
    return info;
  } catch (err) {
    console.warn('iTunes lookup failed:', err);
    return null; // do not cache network failures
  }
}
