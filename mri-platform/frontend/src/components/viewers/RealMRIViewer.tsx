'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  SkipBack,
  SkipForward,
} from 'lucide-react';

interface SliceUrls {
  axial: string[];
  sagittal: string[];
  coronal: string[];
}

interface RealMRIViewerProps {
  sessionId: string;
  sliceUrls: SliceUrls;
  viewerMode: 'patient' | 'doctor' | 'radiologist';
  prediction?: 'CN' | 'MCI' | 'AD';
  confidence?: number;
  showAnnotations?: boolean;
}

type Orientation = 'axial' | 'sagittal' | 'coronal';

const orientationLabels: Record<Orientation, string> = {
  axial: 'Axial (Top-Down)',
  sagittal: 'Sagittal (Side)',
  coronal: 'Coronal (Front)',
};

export const RealMRIViewer: React.FC<RealMRIViewerProps> = ({
  sessionId,
  sliceUrls,
  viewerMode,
  prediction,
  confidence,
  showAnnotations = true,
}) => {
  const [orientation, setOrientation] = useState<Orientation>('axial');
  const [currentSlice, setCurrentSlice] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(150);
  const preloadedRef = useRef<Set<string>>(new Set());
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get slices for current orientation
  const currentSlices = sliceUrls[orientation] || [];
  const totalSlices = currentSlices.length;
  const currentSliceUrl = currentSlices[currentSlice] || '';

  // Preload all images for current orientation
  useEffect(() => {
    const urls = sliceUrls[orientation] || [];
    if (urls.length === 0) return;

    let loadedCount = 0;
    const toLoad = urls.filter((u) => !preloadedRef.current.has(u));

    if (toLoad.length === 0) {
      setInitialLoading(false);
      return;
    }

    setInitialLoading(true);

    toLoad.forEach((url) => {
      const img = new Image();
      img.onload = () => {
        preloadedRef.current.add(url);
        loadedCount++;
        // Mark loading done after first 3 images or all
        if (loadedCount >= Math.min(3, toLoad.length)) {
          setInitialLoading(false);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount >= Math.min(3, toLoad.length)) {
          setInitialLoading(false);
        }
      };
      img.src = url;
    });
  }, [orientation, sliceUrls]);

  // Reset slice index when orientation changes
  useEffect(() => {
    setCurrentSlice(Math.floor((sliceUrls[orientation]?.length || 1) / 2));
    setImageError(false);
  }, [orientation, sliceUrls]);

  // Auto-play animation with adjustable speed
  useEffect(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }

    if (!isPlaying || totalSlices === 0) return;

    playIntervalRef.current = setInterval(() => {
      setCurrentSlice((prev) => (prev >= totalSlices - 1 ? 0 : prev + 1));
    }, playSpeed);

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isPlaying, totalSlices, playSpeed]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentSlice((s) => Math.max(0, s - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentSlice((s) => Math.min(totalSlices - 1, s + 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSlices]);

  const resetView = useCallback(() => {
    setZoom(1);
    setBrightness(100);
    setContrast(100);
    setCurrentSlice(Math.floor(totalSlices / 2));
  }, [totalSlices]);

  // CSS filter for brightness/contrast
  const imageFilter = `brightness(${brightness}%) contrast(${contrast}%)`;

  if (totalSlices === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No brain slices available for viewing.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Slices are generated when a scan is processed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Orientation Tabs */}
      <Tabs value={orientation} onValueChange={(v) => setOrientation(v as Orientation)}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="axial" disabled={!sliceUrls.axial?.length}>
            Axial
          </TabsTrigger>
          <TabsTrigger value="sagittal" disabled={!sliceUrls.sagittal?.length}>
            Sagittal
          </TabsTrigger>
          <TabsTrigger value="coronal" disabled={!sliceUrls.coronal?.length}>
            Coronal
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Toolbar */}
      {viewerMode !== 'patient' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium mr-4">Tools:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
              >
                <ZoomIn className="h-4 w-4 mr-1" />
                Zoom In
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
              >
                <ZoomOut className="h-4 w-4 mr-1" />
                Zoom Out
              </Button>
              <Button size="sm" variant="outline" onClick={resetView}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main viewer */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              {/* Image container with zoom */}
              <div
                className="relative w-full aspect-square flex items-center justify-center overflow-hidden"
                style={{ minHeight: '400px' }}
              >
                {initialLoading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-2" />
                      <p className="text-white/60 text-xs">Loading slices...</p>
                    </div>
                  </div>
                )}

                {imageError && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <p>Failed to load image</p>
                  </div>
                )}

                <img
                  src={currentSliceUrl}
                  alt={`Brain ${orientation} slice ${currentSlice + 1}`}
                  className="max-w-full max-h-full object-contain"
                  style={{
                    filter: imageFilter,
                    transform: `scale(${zoom})`,
                    transition: isPlaying ? 'none' : 'transform 0.2s ease',
                  }}
                  onError={() => setImageError(true)}
                  draggable={false}
                />

                {/* Slice info overlay */}
                <div className="absolute top-2 left-2 text-white text-sm font-mono bg-black/50 px-2 py-1 rounded">
                  <div>Slice: {currentSlice + 1}/{totalSlices}</div>
                  <div>View: {orientationLabels[orientation]}</div>
                  <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
                </div>

                {/* Prediction badge */}
                {showAnnotations && prediction && prediction !== 'CN' && (
                  <div className="absolute top-2 right-2">
                    <Badge
                      className={`text-sm ${
                        prediction === 'AD' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}
                    >
                      {prediction === 'AD' ? "Alzheimer's Disease" : 'Mild Cognitive Impairment'}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Slice Controls */}
            <div className="mt-4 space-y-3">
              {/* Playback controls */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentSlice(0)}
                  title="First slice"
                  className="px-2"
                >
                  <SkipBack className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentSlice((s) => Math.max(0, s - 1))}
                  disabled={currentSlice === 0}
                  className="px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button
                  size="sm"
                  variant={isPlaying ? 'default' : 'outline'}
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-3"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentSlice((s) => Math.min(totalSlices - 1, s + 1))}
                  disabled={currentSlice === totalSlices - 1}
                  className="px-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentSlice(totalSlices - 1)}
                  title="Last slice"
                  className="px-2"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </Button>

                <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                  {currentSlice + 1} / {totalSlices}
                </span>
              </div>

              {/* Slice slider */}
              <Slider
                value={[currentSlice]}
                onValueChange={([val]) => {
                  setIsPlaying(false);
                  setCurrentSlice(val);
                }}
                min={0}
                max={Math.max(0, totalSlices - 1)}
                step={1}
                className="w-full"
              />

              {viewerMode !== 'patient' && (
                <div className="space-y-2 pt-1">
                  {/* Speed control */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium w-20 text-muted-foreground">Speed:</span>
                    <Slider
                      value={[300 - playSpeed]}
                      onValueChange={([val]) => setPlaySpeed(300 - val)}
                      min={0}
                      max={250}
                      step={25}
                      className="flex-1"
                    />
                    <span className="text-xs w-14 text-right text-muted-foreground tabular-nums">
                      {playSpeed}ms
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium w-20 text-muted-foreground">Brightness:</span>
                    <Slider
                      value={[brightness]}
                      onValueChange={([val]) => setBrightness(val)}
                      min={50}
                      max={150}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-xs w-14 text-right text-muted-foreground tabular-nums">{brightness}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium w-20 text-muted-foreground">Contrast:</span>
                    <Slider
                      value={[contrast]}
                      onValueChange={([val]) => setContrast(val)}
                      min={50}
                      max={150}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-xs w-14 text-right text-muted-foreground tabular-nums">{contrast}%</span>
                  </div>
                </div>
              )}

              {/* Keyboard hints */}
              <p className="text-xs text-muted-foreground text-center">
                Arrow keys to navigate | Spacebar to play/pause
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Scan Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session:</span>
                  <span className="font-medium truncate ml-2">{sessionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">View:</span>
                  <span>{orientationLabels[orientation]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Slices:</span>
                  <span>{totalSlices}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Slice:</span>
                  <span>{currentSlice + 1}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Available Views</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Axial:</span>
                  <span>{sliceUrls.axial?.length || 0} slices</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sagittal:</span>
                  <span>{sliceUrls.sagittal?.length || 0} slices</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coronal:</span>
                  <span>{sliceUrls.coronal?.length || 0} slices</span>
                </div>
              </div>
            </div>

            {showAnnotations && prediction && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">AI Analysis</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Primary Finding:</span>
                    <div className="mt-1">
                      <Badge
                        variant={prediction === 'CN' ? 'default' : 'destructive'}
                        className={
                          prediction === 'CN'
                            ? 'bg-green-100 text-green-800'
                            : prediction === 'MCI'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }
                      >
                        {prediction === 'CN' && 'Cognitively Normal'}
                        {prediction === 'MCI' && 'Mild Cognitive Impairment'}
                        {prediction === 'AD' && "Alzheimer's Disease"}
                      </Badge>
                    </div>
                  </div>
                  {confidence !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Confidence:</span>
                      <span className="font-medium">{(confidence * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {prediction !== 'CN' && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                      <p className="font-medium">Key Observations:</p>
                      <p className="text-muted-foreground mt-1">
                        {prediction === 'AD' &&
                          'Hippocampal atrophy, temporal lobe changes visible in axial and coronal views'}
                        {prediction === 'MCI' &&
                          'Early hippocampal changes, best visualized in coronal sections'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {viewerMode === 'radiologist' && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Viewing Tips</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>- Use axial view for overall brain structure</li>
                  <li>- Sagittal view shows corpus callosum</li>
                  <li>- Coronal view best for hippocampal assessment</li>
                  <li>- Adjust brightness/contrast for better visualization</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealMRIViewer;
