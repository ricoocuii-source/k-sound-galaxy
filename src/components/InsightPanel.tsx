/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { MusicNode, ConnectionInsight } from '../types';
import { MUSIC_NODES, MUSIC_LINKS } from '../data';
import { fetchTrackInfo } from '../engine/itunes';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Sparkles, HelpCircle, Link2, Music, User, Globe, Radio, Briefcase, 
  ArrowRight, ShieldAlert, AlertCircle, RefreshCw 
} from 'lucide-react';

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
  const neighborsB = nodeB ? getNeighbors(nodeB) : [];

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'region': return <Globe className="w-4 h-4" />;
      case 'genre': return <Radio className="w-4 h-4" />;
      case 'label': return <Briefcase className="w-4 h-4" />;
      case 'artist': return <User className="w-4 h-4" />;
      default: return <Music className="w-4 h-4" />;
    }
  };

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0.8 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.8 }}
      transition={{ type: 'spring', damping: 26, stiffness: 190 }}
      className="fixed top-4 right-4 bottom-24 w-full max-w-sm md:max-w-md bg-[#040817] border border-slate-800/40 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col z-35"
    >
      
      {/* Panel Top Header bar */}
      <div 
        className="px-5 py-4 border-b border-slate-800/40 flex items-center justify-between bg-[#090e25] transition-all"
        style={{ borderTop: `2px solid ${nodeA.color}` }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span className="text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase">
            {isComparisonMode ? 'Celestial Star Alignment' : 'Star Core Spectrogram'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800/60 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
          title="Collapse Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Panel Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        
        <AnimatePresence mode="wait">
          {!isComparisonMode ? (
            
            // ================= NODE SPEC MODE =================
            <motion.div
              key="node-spec"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Star Core Summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${nodeA.color}15`, color: nodeA.color }}
                  >
                    {getNodeIcon(nodeA.type)}
                  </span>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{nodeA.type} entity</span>
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <span>{nodeA.name}</span>
                      {nodeA.chineseName && nodeA.chineseName !== nodeA.name && (
                        <span className="text-sm text-slate-400 font-normal">({nodeA.chineseName})</span>
                      )}
                    </h2>
                  </div>
                </div>

                {/* Cover/Wallpaper decoration if available */}
                {(nodeAArtwork || nodeA.imageUrl) && (
                  <div className="w-full h-44 rounded-xl overflow-hidden border border-slate-800/40 relative group bg-slate-950 flex items-center justify-center">
                    <img 
                      src={nodeAArtwork || nodeA.imageUrl} 
                      alt={nodeA.name} 
                      className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700`}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#040817] via-transparent to-transparent" />
                  </div>
                )}

                <p className="text-sm text-slate-300 leading-relaxed font-sans">{nodeA.description}</p>
              </div>

              {/* Specific Metadata Fields (e.g., signature song spec) */}
              {(nodeA.type === 'artist' || nodeA.type === 'song') && (
                <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-4 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400">Tempo (Speed)</span>
                    <p className="text-sm font-semibold text-slate-200 font-mono">{nodeA.bpm} BPM</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400">Harmonic Key</span>
                    <p className="text-sm font-semibold text-slate-200 font-mono">{nodeA.key}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400">Atmospheric Mood</span>
                    <p className="text-sm font-semibold text-slate-200" style={{ color: nodeA.color }}>{nodeA.mood}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400">Launch Year</span>
                    <p className="text-sm font-semibold text-slate-200 font-mono">{nodeA.year}</p>
                  </div>
                </div>
              )}

              {/* Celestial Neighbors (Linked Nodes in graph) */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-mono font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Stellar Neighbors</span>
                </h4>
                
                {neighborsA.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {neighborsA.map((node) => (
                      <button
                        key={node.id}
                        onClick={() => onSelectNode(node)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800/80 bg-slate-900/30 text-xs text-slate-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
                      >
                        <span style={{ color: node.color }}>●</span>
                        <span>{node.name}</span>
                        <ArrowRight className="w-2.5 h-2.5 text-slate-500" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-mono italic">No isolated direct orbits detected.</p>
                )}
              </div>

              {/* Dynamic Comparison Prompter */}
              <div className="bg-gradient-to-r from-violet-950/20 to-blue-950/20 border border-violet-900/20 rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-mono text-violet-400 font-semibold uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Double Star Comparison
                </span>
                <p className="text-xs text-slate-300">
                  Hold <b>Shift</b> and click or drag onto another star node to analyze their deep stylistic connection using server-side Gemini.
                </p>
              </div>

            </motion.div>
          ) : (
            
            // ================= COMPARISON MODE =================
            <motion.div
              key="node-comparison"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Star Align Duel Card */}
              <div className="flex items-center justify-between gap-3 bg-slate-900/30 border border-slate-800/40 p-3.5 rounded-xl relative">
                
                {/* Node A */}
                <div className="flex flex-col items-center text-center w-[45%] min-w-0">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border border-slate-700/50 mb-1.5 flex items-center justify-center bg-slate-950">
                    {nodeAArtwork ? (
                      <img src={nodeAArtwork} alt={nodeA.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-mono font-bold" style={{ color: nodeA.color, background: `${nodeA.color}15` }}>
                        {nodeA.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-slate-900 animate-pulse" style={{ backgroundColor: nodeA.color }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{nodeA.type}</span>
                  <h4 className="font-bold text-sm text-slate-200 truncate w-full">{nodeA.name}</h4>
                </div>

                {/* Connection Bridge */}
                <div className="flex flex-col items-center">
                  <span className="text-xs text-amber-500 font-semibold">VS</span>
                  <div className="w-8 h-[1px] bg-slate-800 mt-1" />
                </div>

                {/* Node B */}
                <div className="flex flex-col items-center text-center w-[45%] min-w-0">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border border-slate-700/50 mb-1.5 flex items-center justify-center bg-slate-950">
                    {nodeBArtwork ? (
                      <img src={nodeBArtwork} alt={nodeB.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-mono font-bold" style={{ color: nodeB.color, background: `${nodeB.color}15` }}>
                        {nodeB.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-slate-900 animate-pulse" style={{ backgroundColor: nodeB.color }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{nodeB.type}</span>
                  <h4 className="font-bold text-sm text-slate-200 truncate w-full">{nodeB.name}</h4>
                </div>

              </div>

              {/* Dynamic Loading Spectrogram */}
              {loading && (
                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-amber-500/10 border-t-amber-500 animate-spin" />
                    <Sparkles className="absolute inset-0 m-auto w-4 h-4 text-amber-400 animate-pulse" />
                  </div>
                  <p className="text-xs text-slate-400 font-mono animate-pulse text-center w-full">{loadingMsg}</p>
                </div>
              )}

              {/* Gemini Alignment Insights */}
              {insight && !loading && (
                <div className="space-y-5">
                  
                  {/* Poetic Heuristic text */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-amber-400 font-semibold tracking-wider uppercase flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Gemini DNA Heuristics
                    </span>
                    <p className="text-sm text-slate-200 leading-relaxed bg-slate-900/20 border border-slate-850 p-4 rounded-xl italic">
                      "{insight.explanation}"
                    </p>
                  </div>

                  {/* Shared DNA Tags */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">Shared DNA Frequencies</span>
                    <div className="flex flex-wrap gap-1.5">
                      {insight.sharedDNA.length > 0 ? (
                        insight.sharedDNA.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono px-2 py-1 bg-slate-900 border border-slate-800 text-slate-300 rounded"
                          >
                            #{tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-1 bg-slate-900/20 border border-slate-900 text-slate-500 rounded">
                          #StylisticOverlap
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Key warning popup in case user hasn't added API Key */}
                  {error && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 flex gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-amber-500 font-bold uppercase">Configuration Info</span>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Add your <b>GEMINI_API_KEY</b> in the <b>Settings &gt; Secrets</b> panel to unlock real-time, deep music analysis!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Controllers */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={onClearComparison}
                      className="flex-1 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer text-center"
                    >
                      Clear Alignment
                    </button>
                  </div>

                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}
