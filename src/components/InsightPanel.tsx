/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { MusicNode, ConnectionInsight } from '../types';
import { MUSIC_NODES, MUSIC_LINKS } from '../data';
import { fetchTrackInfo } from '../engine/itunes';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import RetryImage from './RetryImage';

interface InsightPanelProps {
  nodeA: MusicNode | null;
  nodeB: MusicNode | null;
  onClose: () => void;
  onClearComparison: () => void;
  onSelectNode: (node: MusicNode) => void;
}

export default function InsightPanel({
  nodeA,
  nodeB,
  onClose,
  onClearComparison,
  onSelectNode,
}: InsightPanelProps) {
  const [insight, setInsight] = useState<ConnectionInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('Aligning stellar music orbits...');

  const [nodeAArtwork, setNodeAArtwork] = useState<string | null>(null);
  const [nodeBArtwork, setNodeBArtwork] = useState<string | null>(null);

  // Dynamic live lookup for Node A real iTunes artwork
  useEffect(() => {
    if (!nodeA) {
      setNodeAArtwork(null);
      return;
    }

    let isSubscribed = true;
    setNodeAArtwork(null);

    fetchTrackInfo(nodeA)
      .then((info) => {
        if (!isSubscribed) return;
        if (info?.artworkUrlSmall) setNodeAArtwork(info.artworkUrlSmall);
      })
      .catch((err) => {
        console.error('Failed to fetch real artwork for Node A:', err);
      });

    return () => {
      isSubscribed = false;
    };
  }, [nodeA]);

  // Dynamic live lookup for Node B real iTunes artwork
  useEffect(() => {
    if (!nodeB) {
      setNodeBArtwork(null);
      return;
    }

    let isSubscribed = true;
    setNodeBArtwork(null);

    fetchTrackInfo(nodeB)
      .then((info) => {
        if (!isSubscribed) return;
        if (info?.artworkUrlSmall) setNodeBArtwork(info.artworkUrlSmall);
      })
      .catch((err) => {
        console.error('Failed to fetch real artwork for Node B:', err);
      });

    return () => {
      isSubscribed = false;
    };
  }, [nodeB]);

  // Set up loading statement rotations to provide high-quality user experience
  useEffect(() => {
    if (!loading) return;
    const messages = [
      'Aligning stellar music orbits...',
      'Synthesizing melodic waveforms...',
      'Tracing rhythmic parent lineages...',
      'Decoding geographic folklore bonds...',
      'Interrogating copyright wormholes...',
      'Plotting multi-dimensional aesthetic vectors...'
    ];
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % messages.length;
      setLoadingMsg(messages[idx]);
    }, 1800);

    return () => clearInterval(timer);
  }, [loading]);

  // Handle Gemini comparisons when both Node A and Node B are set
  useEffect(() => {
    if (!nodeA || !nodeB) {
      setInsight(null);
      setError(null);
      return;
    }

    const fetchComparisonInsight = async () => {
      setLoading(true);
      setError(null);
      setInsight(null);

      try {
        const res = await fetch('/api/gemini/analyze-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeA, nodeB }),
        });

        if (!res.ok) {
          throw new Error('Cosmic static interrupted. Failed to contact Gemini.');
        }

        const data = await res.json();
        setInsight({
          nodeA,
          nodeB,
          explanation: data.explanation,
          sharedDNA: [...new Set<string>(data.sharedDNA || [])],
        });

        // Add additional metadata if offline backup was triggered
        if (data.offline && data.errorMessage) {
          setError(data.errorMessage);
        }
      } catch (err: any) {
        console.error('Error fetching connection insight:', err);
        setError('Galactic communications suspended. Using automated local analysis.');
        // Heuristic fallback
        setInsight({
          nodeA,
          nodeB,
          explanation: `The cosmic orbit of ${nodeA.name} and ${nodeB.name} outlines a fascinating stylistic dialogue. They blend rhythmic syncopation, modern vocal design, and atmospheric textures to expand the boundaries of modern performance.`,
          sharedDNA: ['Syncopated Drums', 'Atmospheric Pad', 'Signature Mood'],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchComparisonInsight();
  }, [nodeA, nodeB]);

  if (!nodeA) return null;

  const isComparisonMode = !!nodeB;

  // Find all directly connected stellar neighbors
  const getNeighbors = (node: MusicNode) => {
    const directLinks = MUSIC_LINKS.filter(l => l.source === node.id || l.target === node.id);
    const neighborIds = directLinks.map(l => l.source === node.id ? l.target : l.source);
    return MUSIC_NODES.filter(n => neighborIds.includes(n.id) && n.id !== node.id);
  };

  const neighborsA = getNeighbors(nodeA);

  const artistName = (nodeA.artist || '').split('/')[0].trim();

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0.6 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.6 }}
      transition={{ type: 'spring', damping: 28, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full max-w-sm bg-[#05060a]/80 backdrop-blur-xl flex flex-col z-35"
    >
      {/* close */}
      <button
        onClick={onClose}
        className="absolute top-24 right-7 p-1 text-[#e8e0d2]/40 hover:text-[#e8e0d2] transition-colors cursor-pointer z-10"
        title="Close"
      >
        <X className="w-4 h-4" strokeWidth={1.5} />
      </button>

      <div className="flex-1 overflow-y-auto px-8 pt-28 pb-32">
        <AnimatePresence mode="wait">
          {!isComparisonMode ? (

            // ================= SONG DETAIL =================
            <motion.div
              key="node-spec"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-7"
            >
              {/* cover — plain, no gradient overlay */}
              {nodeAArtwork && (
                <div className="w-full aspect-square rounded-lg overflow-hidden bg-[#0d0f16]">
                  <RetryImage src={nodeAArtwork} alt={nodeA.name} className="w-full h-full object-cover" />
                </div>
              )}

              {/* title */}
              <div className="space-y-2.5">
                <h2 className="font-serif font-medium text-3xl text-[#e8e0d2] leading-tight">
                  {nodeA.name}
                  {nodeA.chineseName && nodeA.chineseName !== nodeA.name && (
                    <span className="text-lg text-[#e8e0d2]/45 ml-2.5">{nodeA.chineseName}</span>
                  )}
                </h2>
                {artistName && (
                  <div className="text-[10px] font-mono tracking-[0.24em] uppercase text-[#e8e0d2]/45">
                    {artistName}
                  </div>
                )}
              </div>

              {/* one-line metadata */}
              {(nodeA.type === 'artist' || nodeA.type === 'song') && (
                <div className="text-[11px] font-mono text-[#e8e0d2]/40 tracking-wider">
                  {nodeA.key} · {nodeA.bpm} BPM
                </div>
              )}

              {/* neighbors */}
              {neighborsA.length > 0 && (
                <div className="space-y-3 pt-3">
                  <div className="text-[9px] font-mono tracking-[0.28em] uppercase text-[#e8e0d2]/30">
                    Neighbors
                  </div>
                  <div className="flex flex-col gap-2">
                    {neighborsA.map((node) => (
                      <button
                        key={node.id}
                        onClick={() => onSelectNode(node)}
                        className="flex items-center gap-2.5 text-left text-[#e8e0d2]/60 hover:text-[#e8e0d2] transition-colors cursor-pointer w-fit"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: node.color }}
                        />
                        <span className="font-serif text-base leading-none">{node.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* compare hint */}
              <p className="text-[10px] text-[#e8e0d2]/30 leading-relaxed pt-3">
                Shift-click another star to compare their musical DNA.
              </p>
            </motion.div>
          ) : (

            // ================= COMPARISON =================
            <motion.div
              key="node-comparison"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8"
            >
              {/* duel header */}
              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#0d0f16] shrink-0 flex items-center justify-center">
                    {nodeAArtwork ? (
                      <RetryImage src={nodeAArtwork} alt={nodeA.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-mono" style={{ color: nodeA.color }}>
                        {nodeA.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="font-serif text-sm text-[#e8e0d2]/85 truncate">{nodeA.name}</span>
                </div>
                <span className="text-[9px] font-mono tracking-[0.2em] text-[#e8e0d2]/30 shrink-0">VS</span>
                <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                  <span className="font-serif text-sm text-[#e8e0d2]/85 truncate text-right">{nodeB!.name}</span>
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#0d0f16] shrink-0 flex items-center justify-center">
                    {nodeBArtwork ? (
                      <RetryImage src={nodeBArtwork} alt={nodeB!.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-mono" style={{ color: nodeB!.color }}>
                        {nodeB!.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* loading */}
              {loading && (
                <div className="py-14 flex flex-col items-center gap-5">
                  <div className="w-8 h-8 rounded-full border border-[#e8e0d2]/15 border-t-[#e8e0d2]/70 animate-spin" />
                  <p className="text-[10px] font-mono tracking-[0.18em] uppercase text-[#e8e0d2]/35 text-center">
                    {loadingMsg}
                  </p>
                </div>
              )}

              {/* insight */}
              {insight && !loading && (
                <div className="space-y-7">
                  <p className="font-serif text-lg leading-relaxed text-[#e8e0d2]/85 italic">
                    “{insight.explanation}”
                  </p>

                  {insight.sharedDNA.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {insight.sharedDNA.map((tag, idx) => (
                        <span key={idx} className="text-[10px] font-mono tracking-wider text-[#e8e0d2]/45">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {error && (
                    <p className="text-[10px] text-[#e8e0d2]/30 leading-relaxed">{error}</p>
                  )}

                  <button
                    onClick={onClearComparison}
                    className="text-[10px] font-mono tracking-[0.24em] uppercase text-[#e8e0d2]/45 hover:text-[#e8e0d2] transition-colors cursor-pointer"
                  >
                    Clear comparison
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
