import React, { useState, useEffect } from 'react';
import type { ComicPage, TextAnnotation, AnnotationObject } from '../types';
import { useAnnotations } from '../hooks/useAnnotations';
import { AnnotationToolbar } from './AnnotationToolbar';
import { AnnotationCanvas } from './AnnotationCanvas';
import jsPDF from 'jspdf';

interface ComicDisplayProps {
  pages: ComicPage[];
  onRegeneratePage: (pageId: string, annotatedImageB64: string, annotationText: string) => void;
}

type PageState = {
  annotations: AnnotationObject[];
  history: AnnotationObject[][];
  historyIndex: number;
};

export const ComicDisplay: React.FC<ComicDisplayProps> = ({ pages, onRegeneratePage }) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [allPagesState, setAllPagesState] = useState<Record<string, PageState>>({});
  
  const activePage = pages[currentPageIndex];

  const {
    canvasRef,
    imageContainerRef,
    tool,
    setTool,
    color,
    setColor,
    hasAnnotations,
    history,
    setHistory,
    annotations,
    setAnnotations,
    historyIndex,
    setHistoryIndex,
    activeAnnotationId,
    setActiveAnnotationId,
    eventHandlers,
    clearCanvas,
    handleUndo,
    getAnnotatedImage,
  } = useAnnotations(activePage.imageUrl);

  // Load state when page changes
  useEffect(() => {
    const savedState = allPagesState[activePage.id];
    if (savedState) {
      setAnnotations(savedState.annotations);
      setHistory(savedState.history);
      setHistoryIndex(savedState.historyIndex);
    } else {
      clearCanvas();
    }
  }, [activePage.id, setAnnotations, setHistory, setHistoryIndex, clearCanvas, allPagesState]);


  const handlePageChange = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= pages.length) return;

    // Save current state before switching
    setAllPagesState(prev => ({
      ...prev,
      [activePage.id]: { annotations, history, historyIndex }
    }));
    
    setCurrentPageIndex(newIndex);
  };

  const handleRegenerateClick = async () => {
      const annotatedImageB64 = await getAnnotatedImage();
      if (!annotatedImageB64) return;

      const annotationText = annotations
          .filter((a): a is TextAnnotation => a.type === 'text' && a.text.trim() !== '')
          .map((a, index) => {
             const textAnnotations = annotations.filter(ann => ann.type === 'text');
             const number = textAnnotations.findIndex(ta => ta.id === a.id) + 1;
             return `${number}: ${a.text}`
          })
          .join('\n');
      
      onRegeneratePage(activePage.id, annotatedImageB64, annotationText);
  };
  
  const handleDownload = async () => {
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'px',
      format: [1080, 1350] // Set page size to image aspect ratio
    });

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (i > 0) {
            pdf.addPage();
        }
        await new Promise<void>(resolve => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                 pdf.addImage(img, 'PNG', 0, 0, 1080, 1350);
                 resolve();
            };
            img.onerror = () => {
                console.error(`Failed to load image for page ${i + 1}`);
                resolve(); // Continue to next page even if one fails
            };
            img.src = page.imageUrl;
        });
    }

    pdf.save(`manga-comic-${Date.now()}.pdf`);
  };

  return (
    <div className="w-full max-w-7xl flex flex-col items-center gap-8">
        <div className="w-full text-center">
            <h2 className="font-heading text-3xl font-bold text-zinc-900 mb-2">Your Comic</h2>
            <p className="text-zinc-600">Use the tools to add notes, then regenerate or download your creation.</p>
        </div>

         {/* Page Navigation */}
        <div className="w-full flex items-center justify-center gap-4">
            <button 
                onClick={() => handlePageChange(currentPageIndex - 1)}
                disabled={currentPageIndex === 0}
                className="px-4 py-2 bg-zinc-100 text-zinc-700 font-medium rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                Previous
            </button>
            <span className="font-medium text-zinc-700">
                Page {currentPageIndex + 1} of {pages.length}
            </span>
            <button 
                onClick={() => handlePageChange(currentPageIndex + 1)}
                disabled={currentPageIndex === pages.length - 1}
                 className="px-4 py-2 bg-zinc-100 text-zinc-700 font-medium rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                Next
            </button>
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