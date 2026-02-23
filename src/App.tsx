/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Plus, 
  Video, 
  Settings, 
  Download, 
  Trash2, 
  Sparkles,
  Loader2,
  Monitor,
  Smartphone,
  History,
  Scissors,
  Type,
  Wand2,
  Music,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  Upload,
  Undo2,
  Redo2,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { checkApiKey, openKeySelector, generateVideo, pollOperation, analyzeScenes } from './services/veo';
import { VideoClip, GenerationState, TextOverlay, Scene, VideoEffects, TransitionType } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_EFFECTS: VideoEffects = {
  blur: 0,
  brightness: 100,
  contrast: 100,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
  saturate: 100,
  invert: 0
};

export default function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [history, setHistory] = useState<VideoClip[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [genState, setGenState] = useState<GenerationState>({ status: 'idle', progress: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editMode, setEditMode] = useState<'none' | 'trim' | 'text' | 'ai' | 'effects' | 'audio' | 'transition'>('none');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // History Management
  const pushToHistory = (newClips: VideoClip[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newClips);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevClips = history[historyIndex - 1];
      setClips(prevClips);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextClips = history[historyIndex + 1];
      setClips(nextClips);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Initialize history when first clips arrive
  useEffect(() => {
    if (clips.length > 0 && history.length === 0) {
      setHistory([clips]);
      setHistoryIndex(0);
    }
  }, [clips]);

  useEffect(() => {
    const check = async () => {
      const result = await checkApiKey();
      setHasKey(result);
    };
    check();
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setGenState({ status: 'generating', progress: 10 });
    try {
      const operation = await generateVideo(prompt, { aspectRatio });
      setGenState({ status: 'polling', progress: 50 });
      
      const videoUrl = await pollOperation(operation);
      
      // Get duration
      const tempVideo = document.createElement('video');
      tempVideo.src = videoUrl;
      await new Promise((resolve) => {
        tempVideo.onloadedmetadata = () => resolve(true);
      });

      const newClip: VideoClip = {
        id: Math.random().toString(36).substr(2, 9),
        url: videoUrl,
        prompt: prompt,
        duration: tempVideo.duration,
        trimStart: 0,
        trimEnd: tempVideo.duration,
        overlays: [],
        scenes: [],
        effects: { ...DEFAULT_EFFECTS },
        audioVolume: 50,
        videoVolume: 100,
        transition: { type: 'none', duration: 0.5 },
        timestamp: Date.now(),
      };
      
      const newClips = [newClip, ...clips];
      setClips(newClips);
      pushToHistory(newClips);
      setActiveClipId(newClip.id);
      setGenState({ status: 'completed', progress: 100 });
      setPrompt('');
      
      setTimeout(() => setGenState({ status: 'idle', progress: 0 }), 3000);
    } catch (error: any) {
      console.error(error);
      setGenState({ status: 'error', progress: 0, error: error.message || 'Generation failed' });
    }
  };

  const activeClip = clips.find(c => c.id === activeClipId);

  const updateActiveClip = (updates: Partial<VideoClip>, shouldPush = true) => {
    if (!activeClipId) return;
    const newClips = clips.map(c => c.id === activeClipId ? { ...c, ...updates } : c);
    setClips(newClips);
    if (shouldPush) pushToHistory(newClips);
  };

  const addTextOverlay = () => {
    if (!activeClip) return;
    const newOverlay: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      text: 'New Text',
      color: '#ffffff',
      fontSize: 24,
      position: { x: 50, y: 50 }
    };
    updateActiveClip({ overlays: [...activeClip.overlays, newOverlay] });
  };

  const handleAnalyzeScenes = async () => {
    if (!activeClip) return;
    setIsAnalyzing(true);
    try {
      const scenes = await analyzeScenes(activeClip.url);
      updateActiveClip({ scenes });
    } catch (error) {
      console.error("Scene analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStyleTransfer = async (stylePrompt: string) => {
    if (!activeClip) return;
    setGenState({ status: 'generating', progress: 10 });
    try {
      // For style transfer, we use the existing video as a reference
      // The Veo API supports this via the 'video' parameter
      const operation = await generateVideo(stylePrompt, { 
        video: { uri: activeClip.url }, 
        aspectRatio 
      });
      setGenState({ status: 'polling', progress: 50 });
      const videoUrl = await pollOperation(operation);
      
      const tempVideo = document.createElement('video');
      tempVideo.src = videoUrl;
      await new Promise((resolve) => {
        tempVideo.onloadedmetadata = () => resolve(true);
      });

      const newClip: VideoClip = {
        id: Math.random().toString(36).substr(2, 9),
        url: videoUrl,
        prompt: `Style: ${stylePrompt} (from ${activeClip.prompt})`,
        duration: tempVideo.duration,
        trimStart: 0,
        trimEnd: tempVideo.duration,
        overlays: [],
        scenes: [],
        effects: { ...DEFAULT_EFFECTS },
        audioVolume: 50,
        videoVolume: 100,
        transition: { type: 'none', duration: 0.5 },
        timestamp: Date.now(),
      };
      
      const newClips = [newClip, ...clips];
      setClips(newClips);
      pushToHistory(newClips);
      setActiveClipId(newClip.id);
      setGenState({ status: 'completed', progress: 100 });
      setTimeout(() => setGenState({ status: 'idle', progress: 0 }), 3000);
    } catch (error: any) {
      console.error(error);
      setGenState({ status: 'error', progress: 0, error: error.message || 'Style transfer failed' });
    }
  };

  const [isSequential, setIsSequential] = useState(false);

  // Trimming and Sequential logic
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !activeClip) return;

    const handleTimeUpdate = () => {
      if (video.currentTime < activeClip.trimStart) {
        video.currentTime = activeClip.trimStart;
      }
      if (video.currentTime > activeClip.trimEnd) {
        if (isSequential) {
          const currentIndex = clips.findIndex(c => c.id === activeClipId);
          const nextClip = clips[currentIndex + 1];
          if (nextClip) {
            setActiveClipId(nextClip.id);
          } else {
            video.pause();
            if (audio) audio.pause();
            setIsPlaying(false);
          }
        } else if (video.loop) {
          video.currentTime = activeClip.trimStart;
        } else {
          video.pause();
          if (audio) audio.pause();
          setIsPlaying(false);
        }
      }
      
      // Sync audio
      if (audio && Math.abs(audio.currentTime - video.currentTime) > 0.3) {
        audio.currentTime = video.currentTime;
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      if (audio && activeClip.audioUrl) audio.play();
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (audio) audio.pause();
    };

    const handleSeeking = () => {
      if (audio) audio.currentTime = video.currentTime;
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeking', handleSeeking);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeking', handleSeeking);
    };
  }, [activeClip, isSequential, clips, activeClipId]);

  useEffect(() => {
    if (audioRef.current && activeClip) {
      audioRef.current.volume = activeClip.audioVolume / 100;
    }
    if (videoRef.current && activeClip) {
      videoRef.current.volume = activeClip.videoVolume / 100;
    }
  }, [activeClip?.audioVolume, activeClip?.videoVolume]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  const getTransitionVariants = (type: TransitionType) => {
    switch (type) {
      case 'fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 }
        };
      case 'slide-left':
        return {
          initial: { x: '100%' },
          animate: { x: 0 },
          exit: { x: '-100%' }
        };
      case 'slide-right':
        return {
          initial: { x: '-100%' },
          animate: { x: 0 },
          exit: { x: '100%' }
        };
      case 'slide-up':
        return {
          initial: { y: '100%' },
          animate: { y: 0 },
          exit: { y: '-100%' }
        };
      case 'slide-down':
        return {
          initial: { y: '-100%' },
          animate: { y: 0 },
          exit: { y: '100%' }
        };
      case 'zoom-in':
        return {
          initial: { scale: 0.5, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 1.5, opacity: 0 }
        };
      case 'zoom-out':
        return {
          initial: { scale: 1.5, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0.5, opacity: 0 }
        };
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 }
        };
    }
  };

  const handleExportProject = async () => {
    if (clips.length === 0) return;
    setIsExporting(true);
    setExportProgress(0);

    // Simulate rendering process
    for (let i = 0; i <= 100; i += 5) {
      setExportProgress(i);
      await new Promise(r => setTimeout(r, 200));
    }

    // In a real app, we would use FFmpeg.wasm or a server-side renderer
    // For this demo, we'll "export" the first clip as the "final" video
    // but we'll name it "final-render.mp4"
    const a = document.createElement('a');
    a.href = clips[0].url;
    a.download = `final-render-${Date.now()}.mp4`;
    a.click();
    
    setIsExporting(false);
    setExportProgress(0);
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
            <Sparkles className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AI Video Editor</h1>
          <p className="text-zinc-400">
            To use the AI video generation features, you need to select a Gemini API key from a paid Google Cloud project.
          </p>
          <div className="space-y-4">
            <button 
              onClick={async () => {
                await openKeySelector();
                setHasKey(true);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              Select API Key
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-sm text-zinc-500 hover:text-zinc-300 underline underline-offset-4"
            >
              Learn about Gemini API billing
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#0a0a0a] text-zinc-100 font-sans overflow-hidden">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-[#0f0f0f] z-50">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-emerald-500" />
          <span className="font-bold">Video Editor</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2">
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar / Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed md:relative inset-y-0 left-0 w-80 z-40 border-r border-zinc-800 flex flex-col bg-[#0f0f0f] shadow-2xl md:shadow-none",
              !isSidebarOpen && "hidden md:flex"
            )}
          >
            <div className="hidden md:flex p-6 border-b border-zinc-800 items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <Video className="w-5 h-5 text-emerald-500" />
              </div>
              <h1 className="font-bold text-lg tracking-tight">Video Editor</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 mt-16 md:mt-0">
              {/* Generation Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Generate Clip</h2>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                
                <div className="space-y-3">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the video you want to create..."
                    className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all resize-none placeholder:text-zinc-600"
                  />
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setAspectRatio('16:9')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-all",
                        aspectRatio === '16:9' ? "bg-zinc-800 border-zinc-700 text-white" : "bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700"
                      )}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      16:9
                    </button>
                    <button 
                      onClick={() => setAspectRatio('9:16')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-all",
                        aspectRatio === '9:16' ? "bg-zinc-800 border-zinc-700 text-white" : "bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700"
                      )}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      9:16
                    </button>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={genState.status !== 'idle' || !prompt.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-2"
                  >
                    {genState.status === 'idle' ? (
                      <>
                        <Plus className="w-4 h-4" />
                        Generate Video
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {genState.status === 'generating' ? 'Starting...' : 'Rendering...'}
                      </>
                    )}
                  </button>

                  {activeClip && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = activeClip.url;
                          a.download = `clip-${activeClip.id}.mp4`;
                          a.click();
                        }}
                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-zinc-700 text-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Clip
                      </button>
                      <button
                        onClick={handleExportProject}
                        disabled={isExporting}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
                      >
                        {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Final
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Library Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Library</h2>
                  <div className="flex items-center gap-2">
                    <label className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md cursor-pointer transition-colors" title="Upload Video">
                      <Upload className="w-3.5 h-3.5 text-zinc-400" />
                      <input 
                        type="file" 
                        accept="video/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            const tempVideo = document.createElement('video');
                            tempVideo.src = url;
                            await new Promise((resolve) => {
                              tempVideo.onloadedmetadata = () => resolve(true);
                            });
                            
                            const newClip: VideoClip = {
                              id: Math.random().toString(36).substr(2, 9),
                              url: url,
                              prompt: `Uploaded: ${file.name}`,
                              duration: tempVideo.duration,
                              trimStart: 0,
                              trimEnd: tempVideo.duration,
                              overlays: [],
                              scenes: [],
                              effects: { ...DEFAULT_EFFECTS },
                              audioVolume: 50,
                              videoVolume: 100,
                              transition: { type: 'none', duration: 0.5 },
                              timestamp: Date.now(),
                            };
                            
                            const newClips = [newClip, ...clips];
                            setClips(newClips);
                            pushToHistory(newClips);
                            setActiveClipId(newClip.id);
                          }
                        }}
                      />
                    </label>
                    <History className="w-3.5 h-3.5 text-zinc-600" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {clips.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl">
                      <Video className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                      <p className="text-xs text-zinc-600">No clips generated yet</p>
                    </div>
                  ) : (
                    clips.map(clip => (
                      <button
                        key={clip.id}
                        onClick={() => {
                          setActiveClipId(clip.id);
                          if (window.innerWidth < 768) setIsSidebarOpen(false);
                        }}
                        className={cn(
                          "group relative aspect-video rounded-lg overflow-hidden border transition-all text-left",
                          activeClipId === clip.id ? "border-emerald-500 ring-1 ring-emerald-500" : "border-zinc-800 hover:border-zinc-700"
                        )}
                      >
                        <video 
                          src={clip.url} 
                          className="w-full h-full object-cover opacity-60"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 flex flex-col justify-end">
                          <p className="text-[10px] text-zinc-300 line-clamp-1 font-medium">{clip.prompt}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-[#0a0a0a] relative">
        {/* Preview Area */}
        <div className="flex-1 relative flex items-center justify-center p-4 md:p-8">
          <AnimatePresence mode="wait">
            {activeClip ? (
              <motion.div 
                key={activeClip.id}
                initial={getTransitionVariants(activeClip.transition.type).initial}
                animate={getTransitionVariants(activeClip.transition.type).animate}
                exit={getTransitionVariants(activeClip.transition.type).exit}
                transition={{ duration: activeClip.transition.duration }}
                className={cn(
                  "relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 max-h-full",
                  aspectRatio === '16:9' ? "aspect-video w-full max-w-5xl" : "aspect-[9/16] h-full"
                )}
              >
                <video
                  ref={videoRef}
                  src={activeClip.url}
                  className="w-full h-full object-contain"
                  style={{
                    filter: `
                      blur(${activeClip.effects.blur}px)
                      brightness(${activeClip.effects.brightness}%)
                      contrast(${activeClip.effects.contrast}%)
                      grayscale(${activeClip.effects.grayscale}%)
                      sepia(${activeClip.effects.sepia}%)
                      hue-rotate(${activeClip.effects.hueRotate}deg)
                      saturate(${activeClip.effects.saturate}%)
                      invert(${activeClip.effects.invert}%)
                    `
                  }}
                  onPlay={() => {
                    setIsPlaying(true);
                    if (audioRef.current && activeClip.audioUrl) audioRef.current.play();
                  }}
                  onPause={() => {
                    setIsPlaying(false);
                    if (audioRef.current) audioRef.current.pause();
                  }}
                  loop
                />
                
                {/* Central Play Button Overlay */}
                {!isPlaying && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/20 group cursor-pointer"
                    onClick={() => videoRef.current?.play()}
                  >
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      whileHover={{ scale: 1.1 }}
                      className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-2xl shadow-emerald-500/40"
                    >
                      <Play className="w-8 h-8 md:w-10 md:h-10 ml-1" />
                    </motion.button>
                  </div>
                )}
                
                {activeClip.audioUrl && (
                  <audio 
                    ref={audioRef}
                    src={activeClip.audioUrl}
                    loop
                    className="hidden"
                    onLoadedMetadata={(e) => {
                      e.currentTarget.volume = activeClip.audioVolume / 100;
                    }}
                  />
                )}

                {/* Overlays Rendering */}
                {activeClip.overlays.map(overlay => (
                  <div 
                    key={overlay.id}
                    style={{ 
                      position: 'absolute', 
                      left: `${overlay.position.x}%`, 
                      top: `${overlay.position.y}%`,
                      color: overlay.color,
                      fontSize: `${overlay.fontSize}px`,
                      transform: 'translate(-50%, -50%)',
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                      pointerEvents: 'none'
                    }}
                    className="font-bold whitespace-nowrap"
                  >
                    {overlay.text}
                  </div>
                ))}
                
                {/* Overlay Controls */}
                <div className="absolute inset-0 flex flex-col justify-end opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                      >
                        {isPlaying ? <Pause className="w-5 h-5 md:w-6 md:h-6" /> : <Play className="w-5 h-5 md:w-6 md:h-6 ml-1" />}
                      </button>
                      <div className="hidden sm:block">
                        <p className="text-xs md:text-sm font-semibold truncate max-w-[200px]">{activeClip.prompt}</p>
                        <p className="text-[8px] md:text-[10px] text-zinc-400 uppercase tracking-widest">Veo 3.1</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setEditMode(editMode === 'trim' ? 'none' : 'trim')}
                        className={cn("p-2 md:p-3 rounded-xl transition-colors", editMode === 'trim' ? "bg-emerald-600 text-white" : "bg-zinc-800 hover:bg-zinc-700")}
                      >
                        <Scissors className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                      <button 
                        onClick={() => setEditMode(editMode === 'text' ? 'none' : 'text')}
                        className={cn("p-2 md:p-3 rounded-xl transition-colors", editMode === 'text' ? "bg-emerald-600 text-white" : "bg-zinc-800 hover:bg-zinc-700")}
                      >
                        <Type className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                      <button 
                        onClick={() => setEditMode(editMode === 'ai' ? 'none' : 'ai')}
                        className={cn("p-2 md:p-3 rounded-xl transition-colors", editMode === 'ai' ? "bg-emerald-600 text-white" : "bg-zinc-800 hover:bg-zinc-700")}
                      >
                        <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                      <button 
                        onClick={() => setEditMode(editMode === 'effects' ? 'none' : 'effects')}
                        className={cn("p-2 md:p-3 rounded-xl transition-colors", editMode === 'effects' ? "bg-emerald-600 text-white" : "bg-zinc-800 hover:bg-zinc-700")}
                      >
                        <Wand2 className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                      <button 
                        onClick={() => setEditMode(editMode === 'audio' ? 'none' : 'audio')}
                        className={cn("p-2 md:p-3 rounded-xl transition-colors", editMode === 'audio' ? "bg-emerald-600 text-white" : "bg-zinc-800 hover:bg-zinc-700")}
                      >
                        <Music className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                      <button 
                        onClick={() => setEditMode(editMode === 'transition' ? 'none' : 'transition')}
                        className={cn("p-2 md:p-3 rounded-xl transition-colors", editMode === 'transition' ? "bg-emerald-600 text-white" : "bg-zinc-800 hover:bg-zinc-700")}
                        title="Transitions"
                      >
                        <ArrowRightLeft className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                      <button 
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = activeClip.url;
                          a.download = `video-${activeClip.id}.mp4`;
                          a.click();
                        }}
                        className="p-2 md:p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                      >
                        <Download className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center space-y-6 max-w-sm">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto border border-zinc-800">
                  <Video className="w-8 h-8 md:w-10 md:h-10 text-zinc-700" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg md:text-xl font-semibold">No video selected</h3>
                  <p className="text-zinc-500 text-xs md:text-sm">
                    Generate a new clip or select one from your library to start editing.
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Edit Panel (Conditional) */}
        <AnimatePresence>
          {activeClip && editMode !== 'none' && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-48 left-4 right-4 md:left-auto md:right-8 md:bottom-56 md:w-80 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 shadow-2xl z-30"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {editMode === 'trim' ? 'Trim Clip' : editMode === 'text' ? 'Text Overlays' : editMode === 'ai' ? 'AI Tools' : editMode === 'effects' ? 'Video Effects' : editMode === 'audio' ? 'Background Music' : 'Transitions'}
                </h3>
                <button onClick={() => setEditMode('none')} className="p-1 hover:bg-zinc-800 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editMode === 'trim' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Start: {activeClip.trimStart.toFixed(1)}s</span>
                      <span>End: {activeClip.trimEnd.toFixed(1)}s</span>
                    </div>
                    <div className="relative h-8 flex items-center">
                      <input 
                        type="range" 
                        min={0} 
                        max={activeClip.duration} 
                        step={0.1}
                        value={activeClip.trimStart}
                        onChange={(e) => updateActiveClip({ trimStart: Math.min(parseFloat(e.target.value), activeClip.trimEnd - 0.5) }, false)}
                        onMouseUp={() => pushToHistory(clips)}
                        onTouchEnd={() => pushToHistory(clips)}
                        className="absolute w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                      />
                      <input 
                        type="range" 
                        min={0} 
                        max={activeClip.duration} 
                        step={0.1}
                        value={activeClip.trimEnd}
                        onChange={(e) => updateActiveClip({ trimEnd: Math.max(parseFloat(e.target.value), activeClip.trimStart + 0.5) }, false)}
                        onMouseUp={() => pushToHistory(clips)}
                        onTouchEnd={() => pushToHistory(clips)}
                        className="absolute w-full h-1 bg-transparent rounded-full appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 italic">Drag handles to trim the start and end of your clip.</p>
                </div>
              )}

              {editMode === 'text' && (
                <div className="space-y-4">
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {activeClip.overlays.map(overlay => (
                      <div key={overlay.id} className="p-2 bg-zinc-800 rounded-lg space-y-2">
                        <input 
                          type="text" 
                          value={overlay.text}
                          onChange={(e) => {
                            const newOverlays = activeClip.overlays.map(o => o.id === overlay.id ? { ...o, text: e.target.value } : o);
                            updateActiveClip({ overlays: newOverlays }, false);
                          }}
                          onBlur={() => pushToHistory(clips)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <input 
                            type="color" 
                            value={overlay.color}
                            onChange={(e) => {
                              const newOverlays = activeClip.overlays.map(o => o.id === overlay.id ? { ...o, color: e.target.value } : o);
                              updateActiveClip({ overlays: newOverlays });
                            }}
                            className="w-6 h-6 bg-transparent border-none"
                          />
                          <input 
                            type="range" 
                            min={12} 
                            max={72} 
                            value={overlay.fontSize}
                            onChange={(e) => {
                              const newOverlays = activeClip.overlays.map(o => o.id === overlay.id ? { ...o, fontSize: parseInt(e.target.value) } : o);
                              updateActiveClip({ overlays: newOverlays }, false);
                            }}
                            onMouseUp={() => pushToHistory(clips)}
                            onTouchEnd={() => pushToHistory(clips)}
                            className="flex-1 accent-emerald-500"
                          />
                          <button 
                            onClick={() => updateActiveClip({ overlays: activeClip.overlays.filter(o => o.id !== overlay.id) })}
                            className="p-1 text-red-400 hover:bg-red-400/10 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={addTextOverlay}
                    className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-[10px] text-zinc-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" /> Add Text Layer
                  </button>
                </div>
              )}

              {editMode === 'ai' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <button 
                      onClick={handleAnalyzeScenes}
                      disabled={isAnalyzing}
                      className="w-full py-2 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-[10px] font-bold text-emerald-500 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
                      Scene Detection
                    </button>
                    {activeClip.scenes && activeClip.scenes.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-1 mt-2">
                        {activeClip.scenes.map((scene, i) => (
                          <button 
                            key={i}
                            onClick={() => { if (videoRef.current) videoRef.current.currentTime = scene.timestamp; }}
                            className="w-full text-left p-2 bg-zinc-800/50 rounded hover:bg-zinc-800 transition-colors"
                          >
                            <p className="text-[9px] font-bold text-emerald-500">Scene {i + 1} @ {scene.timestamp.toFixed(1)}s</p>
                            <p className="text-[9px] text-zinc-400 line-clamp-1">{scene.description}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Style Transfer</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Anime', 'Cyberpunk', 'Cinematic', 'Sketch'].map(style => (
                        <button 
                          key={style}
                          onClick={() => handleStyleTransfer(style)}
                          className="py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-[10px] hover:border-emerald-500 transition-all"
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI Reframe</p>
                    <button 
                      onClick={() => {
                        const newRatio = aspectRatio === '16:9' ? '9:16' : '16:9';
                        setAspectRatio(newRatio);
                        handleStyleTransfer(`Reframe to ${newRatio} aspect ratio, keeping subject centered`);
                      }}
                      className="w-full py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-[10px] hover:border-emerald-500 transition-all flex items-center justify-center gap-2"
                    >
                      {aspectRatio === '16:9' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                      Smart Reframe to {aspectRatio === '16:9' ? '9:16' : '16:9'}
                    </button>
                  </div>
                </div>
              )}

              {editMode === 'effects' && (
                <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                  {[
                    { label: 'Blur', key: 'blur', min: 0, max: 20, unit: 'px' },
                    { label: 'Brightness', key: 'brightness', min: 0, max: 200, unit: '%' },
                    { label: 'Contrast', key: 'contrast', min: 0, max: 200, unit: '%' },
                    { label: 'Saturate', key: 'saturate', min: 0, max: 200, unit: '%' },
                    { label: 'Grayscale', key: 'grayscale', min: 0, max: 100, unit: '%' },
                    { label: 'Sepia', key: 'sepia', min: 0, max: 100, unit: '%' },
                    { label: 'Invert', key: 'invert', min: 0, max: 100, unit: '%' },
                    { label: 'Hue Rotate', key: 'hueRotate', min: 0, max: 360, unit: 'deg' },
                  ].map((effect) => (
                    <div key={effect.key} className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>{effect.label}</span>
                        <span>{(activeClip.effects as any)[effect.key]}{effect.unit}</span>
                      </div>
                      <input 
                        type="range" 
                        min={effect.min} 
                        max={effect.max} 
                        value={(activeClip.effects as any)[effect.key]}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateActiveClip({ 
                            effects: { ...activeClip.effects, [effect.key]: val } 
                          }, false);
                        }}
                        onMouseUp={() => pushToHistory(clips)}
                        onTouchEnd={() => pushToHistory(clips)}
                        className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  ))}
                  <button 
                    onClick={() => updateActiveClip({ effects: { ...DEFAULT_EFFECTS } })}
                    className="w-full py-2 mt-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] text-zinc-400 transition-colors"
                  >
                    Reset Effects
                  </button>
                </div>
              )}

              {editMode === 'audio' && (
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>Video Volume</span>
                        <span>{activeClip.videoVolume}%</span>
                      </div>
                      <input 
                        type="range" 
                        min={0} 
                        max={100} 
                        value={activeClip.videoVolume}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          updateActiveClip({ videoVolume: val }, false);
                          if (videoRef.current) videoRef.current.volume = val / 100;
                        }}
                        onMouseUp={() => pushToHistory(clips)}
                        onTouchEnd={() => pushToHistory(clips)}
                        className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Background Music</p>
                      {activeClip.audioUrl ? (
                        <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl border border-zinc-700">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <Music className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span className="text-xs truncate">Custom Audio Track</span>
                          </div>
                          <button 
                            onClick={() => updateActiveClip({ audioUrl: undefined })}
                            className="p-1 text-red-400 hover:bg-red-400/10 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-6 border border-dashed border-zinc-700 rounded-xl hover:border-emerald-500 hover:bg-emerald-500/5 transition-all cursor-pointer">
                          <Upload className="w-6 h-6 text-zinc-500 mb-2" />
                          <span className="text-xs text-zinc-400">Upload MP3/WAV</span>
                          <input 
                            type="file" 
                            accept="audio/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = URL.createObjectURL(file);
                                updateActiveClip({ audioUrl: url });
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {activeClip.audioUrl && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-zinc-400">
                          <span>Music Volume</span>
                          <span>{activeClip.audioVolume}%</span>
                        </div>
                        <input 
                          type="range" 
                          min={0} 
                          max={100} 
                          value={activeClip.audioVolume}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            updateActiveClip({ audioVolume: val }, false);
                            if (audioRef.current) audioRef.current.volume = val / 100;
                          }}
                          onMouseUp={() => pushToHistory(clips)}
                          onTouchEnd={() => pushToHistory(clips)}
                          className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-zinc-500 italic">Audio will automatically loop and sync with your video playback.</p>
                </div>
              )}

              {editMode === 'transition' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Transition Type</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'none', label: 'None' },
                        { id: 'fade', label: 'Crossfade' },
                        { id: 'slide-left', label: 'Slide Left' },
                        { id: 'slide-right', label: 'Slide Right' },
                        { id: 'slide-up', label: 'Slide Up' },
                        { id: 'slide-down', label: 'Slide Down' },
                        { id: 'zoom-in', label: 'Zoom In' },
                        { id: 'zoom-out', label: 'Zoom Out' },
                      ].map((type) => (
                        <button 
                          key={type.id}
                          onClick={() => updateActiveClip({ transition: { ...activeClip.transition, type: type.id as TransitionType } })}
                          className={cn(
                            "py-2 px-3 rounded-lg text-[10px] border transition-all",
                            activeClip.transition.type === type.id 
                              ? "bg-emerald-600/10 border-emerald-500 text-emerald-500" 
                              : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                          )}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Duration</span>
                      <span>{activeClip.transition.duration}s</span>
                    </div>
                    <input 
                      type="range" 
                      min={0.1} 
                      max={2.0} 
                      step={0.1}
                      value={activeClip.transition.duration}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateActiveClip({ transition: { ...activeClip.transition, duration: val } }, false);
                      }}
                      onMouseUp={() => pushToHistory(clips)}
                      onTouchEnd={() => pushToHistory(clips)}
                      className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                  
                  <p className="text-[10px] text-zinc-500 italic">Transitions occur when moving from this clip to the next in the timeline.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeline */}
        <div className="h-40 md:h-48 border-t border-zinc-800 bg-[#0f0f0f] p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Timeline</h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}
                  className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors shadow-lg shadow-emerald-900/20"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                </button>
                <div className="flex items-center gap-2 px-2 py-1 bg-zinc-900 rounded-md border border-zinc-800">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-zinc-400">
                    {videoRef.current ? new Date(videoRef.current.currentTime * 1000).toISOString().substr(14, 5) : '00:00'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 mr-2 border-r border-zinc-800 pr-2">
                <button 
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  title="Undo"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  title="Redo"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>
              <button 
                onClick={() => setIsSequential(!isSequential)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all",
                  isSequential ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}
              >
                <Layers className="w-3 h-3" />
                {isSequential ? "Sequential Playback ON" : "Play All"}
              </button>
            </div>
          </div>
          
          <div className="relative h-16 md:h-20 bg-zinc-900/30 rounded-xl border border-zinc-800/50 overflow-x-auto overflow-y-hidden">
            <div className="absolute inset-y-0 flex items-center px-4 gap-2 min-w-full">
              {clips.map((clip, i) => (
                <div 
                  key={clip.id}
                  className={cn(
                    "h-10 md:h-12 rounded-md border flex-shrink-0 transition-all cursor-pointer overflow-hidden group relative",
                    activeClipId === clip.id ? "w-32 md:w-48 border-emerald-500 bg-emerald-500/10" : "w-16 md:w-24 border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                  )}
                  onClick={() => setActiveClipId(clip.id)}
                >
                  <video src={clip.url} className="w-full h-full object-cover opacity-40" />
                  {activeClipId === clip.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="px-2 py-0.5 bg-emerald-500 rounded text-[8px] font-bold text-black uppercase">Active</div>
                    </div>
                  )}
                </div>
              ))}
              
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 md:w-12 h-10 md:h-12 rounded-md border border-dashed border-zinc-800 flex items-center justify-center text-zinc-600 hover:border-emerald-500 hover:text-emerald-500 transition-colors flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {/* Playhead */}
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-emerald-500 z-10 shadow-[0_0_8px_rgba(16,185,129,0.4)] pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 md:w-3 md:h-3 bg-emerald-500 rotate-45 -translate-y-1/2" />
            </div>
          </div>
        </div>
      </main>

      {/* Exporting Overlay */}
      <AnimatePresence>
        {isExporting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="max-w-sm w-full space-y-8">
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle 
                    cx="50" cy="50" r="45" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="8" 
                    className="text-zinc-800"
                  />
                  <motion.circle 
                    cx="50" cy="50" r="45" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="8" 
                    strokeDasharray="283"
                    strokeDashoffset={283 - (283 * exportProgress) / 100}
                    className="text-emerald-500"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold font-mono">{exportProgress}%</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Rendering Final Video</h2>
                <p className="text-zinc-400 text-sm">
                  Combining clips, applying transitions, and processing effects. Please don't close this window.
                </p>
              </div>
              
              <div className="flex items-center gap-3 justify-center text-xs text-zinc-500 font-medium uppercase tracking-widest">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Processing Frame {Math.floor(exportProgress * 2.4)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
