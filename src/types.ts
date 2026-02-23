export interface TextOverlay {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  position: { x: number; y: number };
}

export interface Scene {
  timestamp: number;
  description: string;
  confidence: number;
}

export interface VideoEffects {
  blur: number;
  brightness: number;
  contrast: number;
  grayscale: number;
  sepia: number;
  hueRotate: number;
  saturate: number;
  invert: number;
}

export type TransitionType = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom-in' | 'zoom-out';

export interface VideoClip {
  id: string;
  url: string;
  prompt: string;
  thumbnail?: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  overlays: TextOverlay[];
  scenes: Scene[];
  effects: VideoEffects;
  audioUrl?: string;
  audioVolume: number;
  videoVolume: number;
  transition: {
    type: TransitionType;
    duration: number;
  };
  timestamp: number;
}

export type GenerationStatus = 'idle' | 'generating' | 'polling' | 'completed' | 'error';

export interface GenerationState {
  status: GenerationStatus;
  progress: number;
  error?: string;
}
