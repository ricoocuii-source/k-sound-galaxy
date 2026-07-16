/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MusicNode } from './types';
import { AnimatePresence } from 'motion/react';
import GalaxyCanvas from './components/GalaxyCanvas';
import MusicPlayer from './components/MusicPlayer';
import InsightPanel from './components/InsightPanel';
import SearchDropdown from './components/SearchDropdown';
import { fetchTrackInfo, TrackInfo } from './engine/itunes';
import { EngineMode } from './engine/GalaxyEngine';
import { RotateCcw } from 'lucide-react';

export interface NavRequest {
  type: 'artist' | 'song';
  id: string;
  nonce: number;
}

export default function App() {
  const [selectedNode, setSelectedNode] = useState<MusicNode | null>(null);
  const [selectedNodeB, setSelectedNodeB] = useState<MusicNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [resetNonce, setResetNonce] = useState(0);
  const [navRequest, setNavRequest] = useState<NavRequest | null>(null);
  // 'line' is the poster landing — chrome (header/player) stays hidden there
  const [engineMode, setEngineMode] = useState<EngineMode>('line');
  const isLanding = engineMode === 'line';

  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);

  // Fetch iTunes metadata whenever the selected song changes
  useEffect(() => {
    if (!selectedNode || selectedNode.type !== 'song') {
      setTrackInfo(null);
      setIsLoadingTrack(false);
      return;
    }
    let cancelled = false;
    setIsLoadingTrack(true);
    setTrackInfo(null);
    fetchTrackInfo(selectedNode).then((info) => {
      if (cancelled) return;
      setTrackInfo(info);
      setIsLoadingTrack(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedNode]);

  const handleSelectNode = (node: MusicNode | null) => {
    setSelectedNode(node);
    if (node && (node.type === 'artist' || node.type === 'song')) {
      setIsPlaying(true);
    }
    if (!node) {
      setIsPlaying(false);
    }
    setSelectedNodeB(null);
  };

  const handleCompareNodes = (nodeA: MusicNode, nodeB: MusicNode) => {
    setSelectedNode(nodeA);
    setSelectedNodeB(nodeB);
  };

  const handleClearComparison = () => {
    setSelectedNodeB(null);
  };

  const handleResetGraph = () => {
    setSelectedNode(null);
    setSelectedNodeB(null);
    setIsPlaying(false);
    setSearchQuery('');
    setResetNonce((n) => n + 1);
  };

  const handleFocusArtist = (artistId: string) => {
    setNavRequest({ type: 'artist', id: artistId, nonce: Date.now() });
  };

  const handleNavigateToSong = (song: MusicNode) => {
    // relies on engine.selectSong's cross-system chaining (focuses the host
    // artist first, then dives into the mirror). Same path as clicking a
    // planet in-scene.
    handleSelectNode(song);
  };

  const activeSong = selectedNode?.type === 'song' || selectedNode?.type === 'artist'
    ? selectedNode
    : (selectedNodeB?.type === 'song' || selectedNodeB?.type === 'artist' ? selectedNodeB : null);


  return (
    <div className="relative w-screen h-screen flex flex-col justify-between overflow-hidden bg-[#05060a] font-sans text-[#e8e0d2]">

      {/* 1. TOP NAVIGATION — transparent, floats over the canvas.
          On the poster landing it retreats entirely; the vertical
          signature inside the canvas carries the brand instead.
          CSS transition (not JS animation) so hidden tabs still settle. */}
      <header
        className={`absolute top-0 left-0 right-0 z-30 px-6 md:px-10 py-5 flex items-center justify-between gap-4 pointer-events-none bg-gradient-to-b from-[#05060a]/85 via-[#05060a]/40 to-transparent transition-all duration-[900ms] ease-out ${
          isLanding ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0 delay-500'
        }`}
      >

        {/* Brand */}
        <div className="flex items-center gap-3" style={{ pointerEvents: isLanding ? 'none' : 'auto' }}>
          <div className="w-6 h-6 rounded-full border border-[#e8e0d2]/50 flex items-center justify-center">
            <span className="w-1 h-1 rounded-full bg-[#e8e0d2]/80" />
          </div>
          <h1 className="text-xl md:text-2xl font-serif font-medium tracking-wide text-[#e8e0d2] leading-none">
            K Sound Galaxy
          </h1>
        </div>

        {/* Search + Reset */}
        <div className="flex items-center gap-3" style={{ pointerEvents: isLanding ? 'none' : 'auto' }}>
          <SearchDropdown
            value={searchQuery}
            onChange={setSearchQuery}
            onSelectArtist={handleFocusArtist}
            onSelectSong={handleNavigateToSong}
          />
          <button
            onClick={handleResetGraph}
            className="p-2 text-[#e8e0d2]/55 hover:text-[#e8e0d2] transition-colors cursor-pointer"
            title="Reset view"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

      </header>

      {/* 2. CENTER PIECE: THE COSMIC GRAPH SIMULATOR */}
      <main className="flex-1 w-full h-full relative z-10">
        <GalaxyCanvas
          selectedNode={selectedNode}
          selectedNodeB={selectedNodeB}
          trackInfo={trackInfo}
          resetNonce={resetNonce}
          navRequest={navRequest}
          onSelectNode={handleSelectNode}
          onCompareNodes={handleCompareNodes}
          onModeChange={setEngineMode}
          searchQuery={searchQuery}
        />

        <AnimatePresence>
          {selectedNode && (
            <InsightPanel
              nodeA={selectedNode}
              nodeB={selectedNodeB}
              onClose={() => {
                setSelectedNode(null);
                setSelectedNodeB(null);
              }}
              onClearComparison={handleClearComparison}
              onSelectNode={handleSelectNode}
            />
          )}
        </AnimatePresence>
      </main>

      {/* 3. BOTTOM PLAYER — slides away on the poster landing */}
      <footer
        className={`w-full relative z-40 transition-transform duration-[900ms] ease-out ${
          isLanding ? 'translate-y-[112%]' : 'translate-y-0 delay-500'
        }`}
      >
        <MusicPlayer
          activeSong={activeSong}
          isPlaying={isPlaying}
          trackInfo={trackInfo}
          isLoadingTrack={isLoadingTrack}
          onPlayToggle={(playing) => setIsPlaying(playing)}
        />
      </footer>

    </div>
  );
}
