import React from 'react';
import type { ComicPage, TextAnnotation } from '../types';
import { useAnnotations } from '../hooks/useAnnotations';
import { AnnotationToolbar } from './AnnotationToolbar';
import { AnnotationCanvas } from './AnnotationCanvas';

interface ComicDisplayProps {
  pages: ComicPage[];
  onRegeneratePage: (pageId: string, annotatedImageB64: string, annotationText: string) => void;
}

export const ComicDisplay: React.FC<ComicDisplayProps> = ({ pages, onRegeneratePage }) => {
  const activePage = pages[0];

  const {
    canvasRef,
    imageContainerRef,
    tool,
    setTool,
    color,
    setColor,
    hasAnnotations,
    history,
    annotations,
    setAnnotations,
    activeAnnotationId,
    setActiveAnnotationId,
    eventHandlers,
    clearCanvas,
    handleUndo,
    getAnnotatedImage,
  } = useAnnotations(activePage.imageUrl);

  const handleRegenerateClick = async () => {
      const annotatedImageB64 = await getAnnotatedImage();
      if (!annotatedImageB64) return;

      // FIX: Use a type guard to correctly filter for TextAnnotation and allow accessing 'text' property.
      const annotationText = annotations
          .filter((a): a is TextAnnotation => a.type === 'text' && a.text.trim() !== '')
          .map((a, index) => `${index + 1}: ${a.text}`)
          .join('\n');
      
      onRegeneratePage(activePage.id, annotatedImageB64, annotationText);
  };
  
  const handleDownload = async () => {
    const link = document.createElement('a');
    link.download = `manga-panel-${Date.now()}.png`;
    const annotatedImage = await getAnnotatedImage(true); // Get image with annotations
    link.href = annotatedImage ?? activePage.imageUrl;
    link.click();
  };

  return (
    <div className="w-full max-w-7xl flex flex-col items-center gap-8">
        <div className="w-full text-center">
            <h2 className="font-heading text-3xl font-bold text-zinc-900 mb-2">Your Comic Panel</h2>
            <p className="text-zinc-600 mb-4">Use the tools to select, move, resize, draw, or add text.</p>
        </div>
        <div className="w-full flex flex-col lg:flex-row-reverse items-start gap-8">
            <AnnotationToolbar
                tool={tool}
                setTool={setTool}
                color={color}
                setColor={setColor}
                handleUndo={handleUndo}
                clearCanvas={clearCanvas}
                historyLength={history.length}
                hasAnnotations={hasAnnotations}
                handleRegenerateClick={handleRegenerateClick}
                handleDownload={handleDownload}
            />
            <AnnotationCanvas
                activePage={activePage}
                tool={tool}
                color={color}
                annotations={annotations}
                setAnnotations={setAnnotations}
                activeAnnotationId={activeAnnotationId}
                setActiveAnnotationId={setActiveAnnotationId}
                eventHandlers={eventHandlers}
                canvasRef={canvasRef}
                imageContainerRef={imageContainerRef}
            />
        </div>
    </div>
  );
};