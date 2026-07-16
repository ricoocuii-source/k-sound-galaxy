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

type ItunesResult = {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl?: string | null;
  artworkUrlSmall?: string | null;
  previewUrl?: string | null;
};

const cache = new Map<string, TrackInfo | null>();
const pendingByTerm = new Map<string, Promise<TrackInfo | null>>();
const artistBatchPromises = new Map<string, Promise<Map<string, TrackInfo | null>>>();
const lookupFailures = new Set<string>();

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

function artistAliases(node: MusicNode): string[] {
  const primaryArtist = node.artist ? node.artist.split('/')[0].trim() : '';
  return (node.itunesArtists && node.itunesArtists.length
    ? node.itunesArtists
    : [node.searchArtist || primaryArtist]
  ).map(normLoose);
}

function findBestTrack(node: MusicNode, results: ItunesResult[]): ItunesResult | undefined {
  const wanted = normTitle(node.name);
  const aliases = artistAliases(node);
  return results.find((result) => {
    if (!result.previewUrl) return false;
    const rawTitle = fold(String(result.trackName || ''));
    if (/\b(karaoke|instrumental|inst\.?|tribute|originally performed)\b/.test(rawTitle)) return false;
    const got = normTitle(String(result.trackName || ''));
    const titleOk =
      got === wanted ||
      got.startsWith(wanted) ||
      wanted.startsWith(got) ||
      (wanted.length >= 8 && got.includes(wanted));
    if (!titleOk) return false;
    const by = normLoose(String(result.artistName || ''));
    return aliases.some((alias) => alias && (by.includes(alias) || alias.includes(by)));
  });
}

function toTrackInfo(result: ItunesResult): TrackInfo {
  return {
    trackName: String(result.trackName || ''),
    artistName: String(result.artistName || ''),
    collectionName: String(result.collectionName || ''),
    artworkUrl: proxied('artwork', result.artworkUrl || null),
    artworkUrlSmall: proxied('artwork', result.artworkUrlSmall || null),
    previewUrl: proxied('audio', result.previewUrl || null),
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJsonWithRetry(url: string): Promise<any> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`search ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await wait(600 * (attempt + 1));
    }
  }
  throw lastError;
}

/** True means the last lookup failed temporarily, rather than confirming no preview exists. */
export function trackLookupFailed(node: MusicNode): boolean {
  return lookupFailures.has(searchTermForNode(node));
}

/**
 * Resolve all visible songs with one artist catalog request. The returned map
 * is keyed by MusicNode id so callers can immediately attach preview URLs.
 */
export function prefetchArtistTrackInfos(nodes: MusicNode[]): Promise<Map<string, TrackInfo | null>> {
  if (!nodes.length) return Promise.resolve(new Map());
  const primaryArtist =
    nodes[0].searchArtist || (nodes[0].artist ? nodes[0].artist.split('/')[0].trim() : '');
  const artistKey = normLoose(primaryArtist);
  const existing = artistBatchPromises.get(artistKey);
  if (existing) return existing;

  const batch = (async () => {
    const byId = new Map<string, TrackInfo | null>();
    try {
      const data = await fetchJsonWithRetry(
        `/api/itunes/catalog?artist=${encodeURIComponent(primaryArtist)}`,
      );
      const results: ItunesResult[] = data.results || [];
      for (const node of nodes) {
        const term = searchTermForNode(node);
        const best = findBestTrack(node, results);
        const info = best ? toTrackInfo(best) : null;
        cache.set(term, info); // A successful catalog response makes this a confirmed result.
        lookupFailures.delete(term);
        byId.set(node.id, info);
      }
    } catch (error) {
      console.warn('iTunes artist catalog lookup failed:', error);
      for (const node of nodes) {
        lookupFailures.add(searchTermForNode(node));
        byId.set(node.id, null);
      }
    }
    return byId;
  })();

  artistBatchPromises.set(artistKey, batch);
  for (const node of nodes) {
    const term = searchTermForNode(node);
    if (cache.has(term) || pendingByTerm.has(term)) continue;
    const pending = batch.then((byId) => byId.get(node.id) ?? null);
    pendingByTerm.set(term, pending);
    void pending.finally(() => {
      if (pendingByTerm.get(term) === pending) pendingByTerm.delete(term);
    });
  }
  void batch.finally(() => artistBatchPromises.delete(artistKey));
  return batch;
}

export async function fetchTrackInfo(node: MusicNode): Promise<TrackInfo | null> {
  const term = searchTermForNode(node);
  if (cache.has(term)) return cache.get(term)!;
  const batchPending = pendingByTerm.get(term);
  if (batchPending) return batchPending;

  try {
    const data = await fetchJsonWithRetry(`/api/itunes/search?term=${encodeURIComponent(term)}`);
    const best = findBestTrack(node, data.results || []);
    const info = best ? toTrackInfo(best) : null;
    cache.set(term, info); // Successful request: null now means a confirmed absence.
    lookupFailures.delete(term);
    return info;
  } catch (error) {
    lookupFailures.add(term);
    console.warn('iTunes lookup failed:', error);
    return null; // Do not cache network failures.
  }
}
