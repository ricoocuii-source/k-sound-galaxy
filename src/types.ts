/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeType = 'region' | 'genre' | 'label' | 'artist' | 'song';

export type NodeMood = 'Atmospheric' | 'Energetic' | 'Chill' | 'Emotional' | 'Futuristic' | 'Organic' | string;

export interface MusicNode {
  id: string;
  name: string;
  type: NodeType;
  color: string; // Hex or HSL glowing color
  radius: number; // For rendering physics size
  
  // Optional metadata based on node type
  chineseName?: string;
  region?: string;
  genre?: string;
  label?: string;
  artist?: string;
  bpm?: number;
  mood?: NodeMood;
  key?: string;
  signatureTrack?: string;
  /** overrides the artist word used in the iTunes search term (e.g. Agust D) */
  searchArtist?: string;
  /** accepted iTunes artist credits for this artist's songs (official aliases / collab leads) */
  itunesArtists?: string[];

  // Physics simulation properties (optional, managed by physics loop)
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  orbitAngle?: number;
}

export interface MusicLink {
  source: string; // source node ID
  target: string; // target node ID
  type: 'belongs_to' | 'created_by' | 'produced_by' | 'stylistically_linked' | 'influential';
  label?: string;
  strength?: number; // 0 to 1
  explanation?: string;
}

export type ViewDimension = 'all' | 'region' | 'genre';

export interface GraphFilter {
  dimension: ViewDimension;
  selectedRegions: string[];
  selectedGenres: string[];
  selectedLabels: string[];
  searchQuery: string;
}

export interface ConnectionInsight {
  nodeA: MusicNode;
  nodeB: MusicNode;
  explanation: string;
  sharedDNA: string[];
}
