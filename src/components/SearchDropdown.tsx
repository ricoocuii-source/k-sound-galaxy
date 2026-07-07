/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live search dropdown. Two chars in → live artist/song matches in a quiet
 * glass overlay. Selecting an artist flies into their galaxy; selecting a
 * song rides the engine's cross-system chain into the time lens.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MusicNode } from '../types';
import { MUSIC_NODES } from '../data';
import { Search, User, Music } from 'lucide-react';

interface Artist {
  id: string;
  name: string;
  chineseName?: string;
  color: string;
  songCount: number;
}

interface SearchDropdownProps {
  value: string;
  onChange: (value: string) => void;
  onSelectArtist: (artistId: string) => void;
  onSelectSong: (song: MusicNode) => void;
}

const MAX_PER_GROUP = 5;
const MIN_CHARS = 2;

export default function SearchDropdown({ value, onChange, onSelectArtist, onSelectSong }: SearchDropdownProps) {
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const artists = useMemo<Artist[]>(() => {
    const map = new Map<string, Artist>();
    MUSIC_NODES.forEach((n) => {
      const artistId = n.id.split('_')[1];
      if (!artistId) return;
      if (!map.has(artistId)) {
        const parts = n.artist ? n.artist.split('/') : [];
        map.set(artistId, {
          id: artistId,
          name: parts[0]?.trim() || artistId,
          chineseName: parts[1]?.trim(),
          color: n.color || '#e8e0d2',
          songCount: 0,
        });
      }
      map.get(artistId)!.songCount += 1;
    });
    return Array.from(map.values());
  }, []);

  const q = value.trim().toLowerCase();
  const showDropdown = focused && q.length >= MIN_CHARS;

  const { artistHits, songHits, flat } = useMemo(() => {
    if (q.length < MIN_CHARS) return { artistHits: [], songHits: [], flat: [] as Array<{ kind: 'artist' | 'song'; item: any }> };

    const aHits = artists
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.chineseName || '').toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_GROUP);

    const sHits = MUSIC_NODES
      .filter(
        (n) =>
          n.type === 'song' &&
          (n.name.toLowerCase().includes(q) ||
            (n.chineseName || '').toLowerCase().includes(q) ||
            (n.artist || '').toLowerCase().includes(q))
      )
      .slice(0, MAX_PER_GROUP);

    const combined: Array<{ kind: 'artist' | 'song'; item: any }> = [
      ...aHits.map((a) => ({ kind: 'artist' as const, item: a })),
      ...sHits.map((s) => ({ kind: 'song' as const, item: s })),
    ];
    return { artistHits: aHits, songHits: sHits, flat: combined };
  }, [q, artists]);

  useEffect(() => {
    setCursor(0);
  }, [q]);

  // Click-outside collapse
  useEffect(() => {
    if (!focused) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [focused]);

  const commit = (entry?: { kind: 'artist' | 'song'; item: any }) => {
    const chosen = entry || flat[cursor];
    if (!chosen) return;
    if (chosen.kind === 'artist') {
      onSelectArtist((chosen.item as Artist).id);
    } else {
      onSelectSong(chosen.item as MusicNode);
    }
    onChange('');
    setFocused(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || flat.length === 0) {
      if (e.key === 'Escape') {
        onChange('');
        inputRef.current?.blur();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (c + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (c - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      onChange('');
      inputRef.current?.blur();
    }
  };

  const highlight = (text: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-[#e8e0d2]">{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#e8e0d2]/45" strokeWidth={1.5} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          className="w-40 md:w-56 pl-6 pr-2 py-1.5 bg-transparent border-b border-[#e8e0d2]/25 focus:border-[#e8e0d2]/60 text-sm text-[#e8e0d2] placeholder:text-[#e8e0d2]/35 focus:outline-none transition-colors font-sans"
        />
      </div>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-3 w-[22rem] max-w-[calc(100vw-3rem)] bg-[#05060a]/90 backdrop-blur-xl rounded-lg shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden">
          {flat.length === 0 ? (
            <div className="px-5 py-6 text-[#e8e0d2]/40 text-xs font-mono tracking-widest uppercase">
              No matches
            </div>
          ) : (
            <div className="py-2 max-h-[60vh] overflow-y-auto">
              {artistHits.length > 0 && (
                <>
                  <div className="px-5 pt-2 pb-1 text-[9px] font-mono tracking-[0.24em] uppercase text-[#e8e0d2]/35">
                    Artists
                  </div>
                  {artistHits.map((a, i) => {
                    const idx = i;
                    const active = idx === cursor;
                    return (
                      <button
                        key={`a-${a.id}`}
                        onMouseEnter={() => setCursor(idx)}
                        onMouseDown={(e) => { e.preventDefault(); commit({ kind: 'artist', item: a }); }}
                        className={`w-full text-left px-5 py-2 flex items-center gap-3 transition-colors cursor-pointer ${
                          active ? 'bg-[#e8e0d2]/6' : 'hover:bg-[#e8e0d2]/4'
                        }`}
                      >
                        <User className="w-3.5 h-3.5 text-[#e8e0d2]/40 shrink-0" strokeWidth={1.5} />
                        <div className="flex-1 min-w-0 flex items-baseline gap-2">
                          <span className="text-sm font-serif text-[#e8e0d2]/85 truncate">
                            {highlight(a.name)}
                          </span>
                          {a.chineseName && (
                            <span className="text-[11px] text-[#e8e0d2]/40 truncate">
                              {highlight(a.chineseName)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-[#e8e0d2]/30 tracking-wider">
                          {a.songCount}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
              {songHits.length > 0 && (
                <>
                  <div className="px-5 pt-3 pb-1 text-[9px] font-mono tracking-[0.24em] uppercase text-[#e8e0d2]/35">
                    Songs
                  </div>
                  {songHits.map((s, i) => {
                    const idx = artistHits.length + i;
                    const active = idx === cursor;
                    return (
                      <button
                        key={`s-${s.id}`}
                        onMouseEnter={() => setCursor(idx)}
                        onMouseDown={(e) => { e.preventDefault(); commit({ kind: 'song', item: s }); }}
                        className={`w-full text-left px-5 py-2 flex items-center gap-3 transition-colors cursor-pointer ${
                          active ? 'bg-[#e8e0d2]/6' : 'hover:bg-[#e8e0d2]/4'
                        }`}
                      >
                        <Music className="w-3.5 h-3.5 text-[#e8e0d2]/40 shrink-0" strokeWidth={1.5} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-serif text-[#e8e0d2]/85 truncate">
                            {highlight(s.name)}
                          </div>
                          <div className="text-[11px] text-[#e8e0d2]/40 truncate">
                            {(s.artist || '').split('/')[0].trim()}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
