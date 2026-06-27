import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, RefreshCw, Grab } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function ImageLightbox({ src, alt = 'Screenshot Preview', onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Adjust zoom handlers
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return; // Only pan when zoomed in
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile / tablet devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale <= 1) return; // Only pan when zoomed in
    const touch = e.touches[0];
    setIsDragging(true);
    dragStart.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm p-4 select-none"
        id="image_lightbox_root"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Floating Controls Bar */}
        <div 
          className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-full shadow-2xl backdrop-blur-md z-50 text-white"
          id="lightbox_toolbar"
        >
          <button 
            onClick={handleZoomIn} 
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button 
            onClick={handleZoomOut} 
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button 
            onClick={handleRotate} 
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-300 hover:text-white"
            title="Rotate 90°"
          >
            <RotateCw className="h-5 w-5" />
          </button>
          <button 
            onClick={handleReset} 
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-300 hover:text-white"
            title="Reset Zoom"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          
          <div className="h-4 w-px bg-slate-800 mx-1" />

          {scale > 1 && (
            <div className="flex items-center text-xs text-emerald-400 font-mono px-2 gap-1.5 animate-pulse">
              <Grab className="h-4 w-4" />
              <span>Drag to Pan</span>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-slate-900/80 border border-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-50 shadow-xl"
          id="lightbox_close"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Image Container with animated gesture mapping */}
        <div 
          className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-move"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <motion.img
            ref={imageRef}
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg transition-transform duration-75 select-none pointer-events-none shadow-2xl"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          />
        </div>

        {/* Bottom Metadata Panel */}
        {alt && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/40 border border-slate-800/50 px-5 py-2.5 rounded-xl backdrop-blur-sm text-xs text-slate-300 font-medium tracking-wide shadow-lg">
            {alt}
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
