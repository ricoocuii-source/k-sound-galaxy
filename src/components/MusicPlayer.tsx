/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bottom player — everything trimmed to: cover, name, playhead, volume.
 * No mode switcher, no metadata badges, no waveform background. iTunes
 * preview plays by default; on failure (or no preview available) the
 * procedural synth fills in silently.
 */

import React, { useEffect, useRef, useState } from 'react';
import { MusicNode } from '../types';
import musicSynth from '../synth';
import { TrackInfo } from '../engine/itunes';
import { Play, Pause, Volume2 } from 'lucide-react';

interface MusicPlayerProps {
  activeSong: MusicNode | null;
  isPlaying: boolean;
  trackInfo: TrackInfo | null;
  isLoadingTrack: boolean;
  onPlayToggle: (playing: boolean) => void;
}

export default function MusicPlayer({ activeSong, isPlaying, trackInfo, onPlayToggle }: MusicPlayerProps) {
  const [volume, setVolume] = useState(0.5);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const progressIntervalRef = useRef<any>(null);

  const previewUrl = trackInfo?.previewUrl || null;
  const artworkUrl = trackInfo?.artworkUrlSmall || null;
  const usingSynth = activeSong ? !previewUrl : false;

  useEffect(() => {
    if (!activeSong) {
      musicSynth.pause();
      stopProgress();
      setProgress(0);
      return;
    }

    if (usingSynth && activeSong.synthConfig) {
      if (isPlaying) {
        musicSynth.play(activeSong.synthConfig);
        startProgress('synth');
      } else {
        musicSynth.pause();
        stopProgress();
      }
    } else if (previewUrl) {
      if (isPlaying) {
        musicSynth.playPreview(previewUrl);
        startProgress('real');
      } else {
        musicSynth.pause();
        stopProgress();
      }
    }

    return () => stopProgress();
  }, [activeSong, isPlaying, previewUrl, usingSynth]);

  const startProgress = (kind: 'real' | 'synth') => {
    stopProgress();
    if (kind === 'synth') {
      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + 0.6));
        setCurrentTime((prev) => (prev >= 180 ? 0 : prev + 0.9));
      }, 500);
      setDuration(180);
    } else {
      progressIntervalRef.current = setInterval(() => {
        const prog = musicSynth.getPreviewProgress();
        setCurrentTime(prog.currentTime);
        setDuration(prog.duration || 30);
        setProgress(prog.duration > 0 ? (prog.currentTime / prog.duration) * 100 : 0);
      }, 200);
    }
  };

  const stopProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  useEffect(() => {
    musicSynth.setVolume(volume);
  }, [volume]);

  const handlePlayClick = () => {
    if (!activeSong) return;
    onPlayToggle(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const artistName =
    trackInfo?.artistName ||
    activeSong?.artist?.split('/')[0].trim() ||
    '';

  return (
    <div className="w-full px-6 md:px-10 py-4 md:py-5 flex items-center gap-5 md:gap-8 relative z-40 bg-gradient-to-t from-[#05060a] via-[#05060a]/85 to-transparent">
      {/* Cover + title */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-11 h-11 md:w-12 md:h-12 rounded-md bg-[#0d0f16] overflow-hidden shrink-0 flex items-center justify-center">
          {activeSong && artworkUrl ? (
            <img src={artworkUrl} alt={activeSong.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-[#e8e0d2]/25" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {activeSong ? (
            <>
              <div className="font-serif text-base md:text-lg text-[#e8e0d2] truncate leading-tight">
                {activeSong.name}
              </div>
              <div className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#e8e0d2]/45 mt-1 truncate">
                {artistName}
              </div>
            </>
          ) : (
            <div className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#e8e0d2]/30">
              Select a song
            </div>
          )}
        </div>
      </div>

      {/* Play + progress */}
      <div className="flex items-center gap-4 md:gap-5 flex-[1.6] min-w-0">
        <button
          onClick={handlePlayClick}
          disabled={!activeSong}
          className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all shrink-0 ${
            activeSong
              ? 'border-[#e8e0d2]/50 text-[#e8e0d2]/85 hover:border-[#e8e0d2] hover:text-[#e8e0d2] cursor-pointer'
              : 'border-[#e8e0d2]/12 text-[#e8e0d2]/20 cursor-not-allowed'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5" strokeWidth={1.4} fill="currentColor" />
          ) : (
            <Play className="w-3.5 h-3.5 ml-0.5" strokeWidth={1.4} fill="currentColor" />
          )}
        </button>

        <span className="text-[10px] font-mono text-[#e8e0d2]/40 tabular-nums w-9 text-right shrink-0">
          {formatTime(currentTime)}
        </span>
        <div className="flex-1 h-px bg-[#e8e0d2]/12 relative overflow-hidden min-w-0">
          <div
            className="absolute inset-y-0 left-0 bg-[#e8e0d2]/70 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-[#e8e0d2]/40 tabular-nums w-9 shrink-0">
          {formatTime(duration)}
        </span>
      </div>

      {/* Volume */}
      <div className="hidden md:flex items-center gap-2 w-32 shrink-0">
        <Volume2 className="w-3.5 h-3.5 text-[#e8e0d2]/40" strokeWidth={1.4} />
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 h-px bg-[#e8e0d2]/15 appearance-none cursor-pointer volume-slider"
          title="Volume"
        />
      </div>
    </div>
  );
}
