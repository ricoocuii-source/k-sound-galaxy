/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GalaxyCanvas — React shell around the WebGL GalaxyEngine.
 * HUD is intentionally sparse: a text back link, minimal zoom controls,
 * and the floating song title card under the time mirror. Everything else
 * lives in the scene.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { AnimatePresence, motion } from 'motion/react';
import { MusicNode } from '../types';
import { MUSIC_NODES } from '../data';
import { GalaxyEngine, ArtistDef, EngineMode } from '../engine/GalaxyEngine';
import { TrackInfo } from '../engine/itunes';
import { NavRequest } from '../App';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

/**
 * Extract a tasteful accent color from a cover image: saturation-weighted hue
 * histogram → dominant hue → normalized to a calm, airy tone that harmonizes
 * with the cosmos (dust / halo pick it up). Returns null for near-monochrome
 * covers or on any canvas failure — the accent is strictly optional.
 */
function extractCoverAccent(image: HTMLImageElement | undefined): string | null {
  if (!image || !image.width) return null;
  try {
    const S = 24;
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, S, S);
    const data = ctx.getImageData(0, 0, S, S).data;
    const buckets = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const l = (mx + mn) / 2;
      const d = mx - mn;
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      if (s < 0.12 || l < 0.12 || l > 0.92) continue; // skip greys / extremes
      let h = 0;
      if (mx === r) h = ((g - b) / d + 6) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      const k = Math.floor(((h * 60) % 360) / 30) % 12;
      const w = s * (1 - Math.abs(2 * l - 1)); // vivid mid-tones weigh most
      buckets[k].w += w;
      buckets[k].r += r * w;
      buckets[k].g += g * w;
      buckets[k].b += b * w;
    }
    let best = buckets[0];
    for (const bk of buckets) if (bk.w > best.w) best = bk;
    if (best.w < 1) return null; // essentially monochrome cover
    const col = new THREE.Color(best.r / best.w, best.g / best.w, best.b / best.w);
    const hsl = { h: 0, s: 0, l: 0 };
    col.getHSL(hsl);
    // calm it down: keep the hue, tame saturation, fix an airy lightness
    col.setHSL(hsl.h, Math.min(0.42, Math.max(0.22, hsl.s * 0.7)), 0.68);
    return `#${col.getHexString()}`;
  } catch {
    return null;
  }
}

interface GalaxyCanvasProps {
  selectedNode: MusicNode | null;
  selectedNodeB: MusicNode | null;
  trackInfo: TrackInfo | null;
  resetNonce: number;
  navRequest: NavRequest | null;
  onSelectNode: (node: MusicNode | null) => void;
  onCompareNodes: (nodeA: MusicNode, nodeB: MusicNode) => void;
  searchQuery: string;
}

export default function GalaxyCanvas({
  selectedNode,
  selectedNodeB,
  trackInfo,
  resetNonce,
  navRequest,
  onSelectNode,
  onCompareNodes,
  searchQuery,
}: GalaxyCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelLayerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GalaxyEngine | null>(null);
  const mirrorCardRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<EngineMode>('overview');
  const [, setFocusedArtistId] = useState<string | null>(null);

  const selectedRef = useRef<MusicNode | null>(null);
  selectedRef.current = selectedNode;

  const artists = useMemo<ArtistDef[]>(() => {
    const map = new Map<string, ArtistDef>();
    MUSIC_NODES.forEach((node) => {
      const artistId = node.id.split('_')[1] || 'unknown';
      const displayParts = node.artist ? node.artist.split('/') : [node.name];
      if (!map.has(artistId)) {
        map.set(artistId, {
          id: artistId,
          name: displayParts[0].trim(),
          chineseName: displayParts[1]?.trim(),
          color: node.color || '#e8e0d2',
          genre: node.genre || 'genre_pop',
          region: node.region || 'region_kr',
          songs: [],
        });
      }
      map.get(artistId)!.songs.push(node);
    });
    return Array.from(map.values());
  }, []);

  // ---- engine lifecycle ----
  useEffect(() => {
    if (!containerRef.current || !labelLayerRef.current) return;

    const engine = new GalaxyEngine(containerRef.current, labelLayerRef.current, artists, {
      onFocusArtist: (id) => setFocusedArtistId(id),
      onSelectSong: (song, shift) => {
        if (shift && selectedRef.current && selectedRef.current.id !== song.id) {
          onCompareNodes(selectedRef.current, song);
        } else {
          onSelectNode(song);
        }
      },
      onDeselectSong: () => onSelectNode(null),
      onHoverChange: () => {},
      onModeChange: (m) => setMode(m),
    });
    engineRef.current = engine;

    // position the mirror title card every frame without React re-renders
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const card = mirrorCardRef.current;
      if (!card) return;
      const anchor = engine.getMirrorAnchor();
      if (anchor) {
        card.style.opacity = '1';
        card.style.transform = `translate(-50%, 0) translate(${anchor.x}px, ${anchor.y}px)`;
      } else {
        card.style.opacity = '0';
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists]);

  useEffect(() => {
    engineRef.current?.setSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (resetNonce > 0) engineRef.current?.flyToOverview(true);
  }, [resetNonce]);

  // nav requests from the search dropdown
  useEffect(() => {
    if (!navRequest) return;
    if (navRequest.type === 'artist') {
      engineRef.current?.focusArtist(navRequest.id);
    }
    // song nav routes through onSelectNode already
  }, [navRequest]);

  // selection driven from outside
  const lastSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const id = selectedNode?.id || null;
    if (id === lastSelectedIdRef.current) return;
    lastSelectedIdRef.current = id;

    if (selectedNode && selectedNode.type === 'song') {
      engine.selectSong(selectedNode);
    } else if (!selectedNode && engine.mode === 'song') {
      engine.deselectSong(false);
    }
  }, [selectedNode]);

  useEffect(() => {
    engineRef.current?.setCompareSong(selectedNodeB);
  }, [selectedNodeB]);

  // artwork → mirror texture
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!trackInfo?.artworkUrl) {
      engine.setMirrorTexture(null);
      return;
    }
    let cancelled = false;
    const url = trackInfo.artworkUrl;
    const load = (attempt: number) => {
      new THREE.TextureLoader().load(
        url,
        (tex) => {
          if (cancelled) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          engine.setMirrorTexture(tex, extractCoverAccent(tex.image));
        },
        undefined,
        () => {
          // transient proxy/CDN failures happen — retry a couple of times
          if (!cancelled && attempt < 2) {
            setTimeout(() => {
              if (!cancelled) load(attempt + 1);
            }, 700 * (attempt + 1));
          }
        }
      );
    };
    load(0);
    return () => {
      cancelled = true;
    };
  }, [trackInfo?.artworkUrl]);

  const goBack = () => {
    if (mode === 'song') {
      onSelectNode(null);
      engineRef.current?.deselectSong(false);
    } else if (mode === 'artist') {
      engineRef.current?.flyToOverview();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#05060a] overflow-hidden select-none cursor-grab active:cursor-grabbing"
      id="galaxy-canvas-container"
    >
      {/* DOM label layer (managed imperatively by the engine) */}
      <div ref={labelLayerRef} className="absolute inset-0 z-10 pointer-events-none overflow-hidden" />

      {/* cinematic vignette — reaches further toward center to keep the void deep */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 34%, rgba(5,6,10,0.28) 68%, rgba(5,6,10,0.82) 100%)' }}
      />

      {/* film grain */}
      <div className="galaxy-grain absolute inset-0 z-10 pointer-events-none" />

      {/* song title card under the mirror */}
      <div
        ref={mirrorCardRef}
        className="absolute z-20 pointer-events-none text-center transition-opacity duration-500"
        style={{ opacity: 0, left: 0, top: 0 }}
      >
        {selectedNode && mode === 'song' && (
          <div className="flex flex-col items-center gap-1.5">
            <div className="font-serif font-medium text-2xl tracking-wide text-[#e8e0d2] drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
              {selectedNode.name}
            </div>
            <div className="text-[#e8e0d2]/50 text-[10px] font-mono tracking-[0.24em] uppercase">
              {trackInfo?.artistName || selectedNode.artist?.split('/')[0].trim()}
              {trackInfo?.collectionName ? ` · ${trackInfo.collectionName}` : ''}
            </div>
          </div>
        )}
      </div>

      {/* ← Back — visible only inside a system */}
      <AnimatePresence>
        {mode !== 'overview' && (
          <motion.button
            key="back"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.3 }}
            onClick={goBack}
            className="absolute top-[92px] left-6 md:left-10 z-30 text-[10px] font-mono tracking-[0.28em] uppercase text-[#e8e0d2]/50 hover:text-[#e8e0d2] transition-colors cursor-pointer"
          >
            ← Galaxy
          </motion.button>
        )}
      </AnimatePresence>

      {/* Zoom controls — three quiet icons */}
      <div className="absolute bottom-24 right-6 md:right-10 z-30 flex flex-col items-center gap-3">
        <button
          onClick={() => engineRef.current?.zoomBy(0.8)}
          className="text-[#e8e0d2]/40 hover:text-[#e8e0d2] transition-colors cursor-pointer"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" strokeWidth={1.3} />
        </button>
        <button
          onClick={() => engineRef.current?.zoomBy(1.25)}
          className="text-[#e8e0d2]/40 hover:text-[#e8e0d2] transition-colors cursor-pointer"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" strokeWidth={1.3} />
        </button>
        <button
          onClick={() => engineRef.current?.resetView()}
          className="text-[#e8e0d2]/40 hover:text-[#e8e0d2] transition-colors cursor-pointer"
          title="Re-center view"
        >
          <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.3} />
        </button>
      </div>
    </div>
  );
}
