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

export function searchTermForNode(node: MusicNode): string {
  const primaryArtist = node.artist ? node.artist.split('/')[0].trim() : '';
  return `${node.name} ${primaryArtist}`.trim();
}

export async function fetchTrackInfo(node: MusicNode): Promise<TrackInfo | null> {
  const term = searchTermForNode(node);
  if (cache.has(term)) return cache.get(term)!;

  try {
    const res = await fetch(`/api/itunes/search?term=${encodeURIComponent(term)}`);
    if (!res.ok) throw new Error(`search ${res.status}`);
    const data = await res.json();
    const results: any[] = data.results || [];

    // Prefer a result whose track name loosely matches and that has a preview
    const lowerName = node.name.toLowerCase();
    const best =
      results.find(
        (r) => r.previewUrl && String(r.trackName || '').toLowerCase().includes(lowerName)
      ) ||
      results.find((r) => r.previewUrl) ||
      results[0];

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
