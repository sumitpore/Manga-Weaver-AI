import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ComicPage, TextAnnotation, AnnotationObject, TextElement } from '../types';
import { useAnnotations } from '../hooks/useAnnotations';
import { AnnotationToolbar } from './AnnotationToolbar';
import { AnnotationCanvas } from './AnnotationCanvas';
import jsPDF from 'jspdf';
import { parsePx } from '../utils/canvas';


interface ComicDisplayProps {
  pages: ComicPage[];
  onRegeneratePage: (pageId: string, annotatedImageB64: string, annotationText: string) => void;
  onUpdateTextElements: (pageId: string, updatedTextElements: TextElement[]) => void;
  setIsDownloadingPdf: (isDownloading: boolean) => void;
}

type PageState = {
  annotations: AnnotationObject[];
  history: AnnotationObject[][];
  historyIndex: number;
};

export const ComicDisplay: React.FC<ComicDisplayProps> = ({ pages, onRegeneratePage, onUpdateTextElements, setIsDownloadingPdf }) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [allPagesState, setAllPagesState] = useState<Record<string, PageState>>({});
  const [selectedTextElementId, setSelectedTextElementId] = useState<string | null>(null);
  const [editingTextElementId, setEditingTextElementId] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  const activePage = pages[currentPageIndex];
  
  // FIX: The useAnnotations hook expects 2 arguments, but was called with 3. Removed the extra argument.
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
    commitActiveAnnotation,
  } = useAnnotations(activePage.imageUrl, editingTextElementId);

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
    setEditingTextElementId(null);
    setSelectedTextElementId(null);
  }, [activePage.id, setAnnotations, setHistory, setHistoryIndex, clearCanvas, allPagesState]);


  const handlePageChange = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= pages.length) return;

    // Save current annotation state before switching
    setAllPagesState(prev => ({
      ...prev,
      [activePage.id]: { annotations, history, historyIndex }
    }));
    
    // Clear text element selection when changing pages
    setSelectedTextElementId(null);
    setEditingTextElementId(null);
    
    setCurrentPageIndex(newIndex);
  };
  
  const handleTextUpdate = useCallback((elementId: string, newText: string) => {
      const newElements = activePage.textElements.map(el =>
          el.id === elementId ? { ...el, text: newText } : el
      );
      onUpdateTextElements(activePage.id, newElements);
  }, [activePage, onUpdateTextElements]);

  const handlePositionUpdate = useCallback((elementId: string, newX: string, newY: string) => {
      const newElements = activePage.textElements.map(el =>
          el.id === elementId ? { ...el, x: newX, y: newY } : el
      );
      onUpdateTextElements(activePage.id, newElements);
  }, [activePage, onUpdateTextElements]);

  const handleAnchorUpdate = useCallback((elementId: string, newAnchor: { x: string; y: string }) => {
    const newElements = activePage.textElements.map(el =>
        el.id === elementId ? { ...el, anchor: newAnchor } : el
    );
    onUpdateTextElements(activePage.id, newElements);
}, [activePage, onUpdateTextElements]);

  const handleTextDelete = useCallback((elementId: string) => {
      const newElements = activePage.textElements.filter(el => el.id !== elementId);
      onUpdateTextElements(activePage.id, newElements);
      // Clear selection after deletion
      setSelectedTextElementId(null);
      setEditingTextElementId(null);
  }, [activePage, onUpdateTextElements]);

  const handleTextElementSelect = useCallback((elementId: string | null) => {
      setSelectedTextElementId(elementId);
      if (elementId === null) {
        setEditingTextElementId(null);
      }
  }, []);

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
  
const handleDownload = useCallback(async () => {
    setIsDownloadingPdf(true);
    const container = imageContainerRef.current;

    try {
        if (container) {
            container.classList.add('pdf-export-mode');
        }

        setSelectedTextElementId(null);
        setEditingTextElementId(null);
        setActiveAnnotationId(null);
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: [1024, 1024]
        });

        const { default: html2canvas } = await import('https://aistudiocdn.com/html2canvas@^1.4.1');
        const originalPageIndex = currentPageIndex;
        const currentPages = pages;

        for (let i = 0; i < currentPages.length; i++) {
            if (currentPageIndex !== i) {
                setCurrentPageIndex(i);
                
                await new Promise<void>(resolve => {
                    requestAnimationFrame(() => {
                        setTimeout(resolve, 250);
                    });
                });
            }

            const containerToCapture = imageContainerRef.current;
            if (!containerToCapture) continue;

            const images = containerToCapture.querySelectorAll('img');
            await Promise.all(Array.from(images).map(img => 
                img.complete ? Promise.resolve() : new Promise<void>(resolve => {
                    const timeout = setTimeout(resolve, 2000);
                    img.onload = () => { clearTimeout(timeout); resolve(); };
                    img.onerror = () => { clearTimeout(timeout); resolve(); };
                })
            ));

            await document.fonts.ready;
            await new Promise<void>(resolve => setTimeout(resolve, 50));

            const canvas = await html2canvas(containerToCapture, {
                width: 1024,
                height: 1024,
                useCORS: true,
                logging: false,
                backgroundColor: null,
                scale: 1,
            });

            const imgData = canvas.toDataURL('image/png', 1.0);
            if (i > 0) pdf.addPage([1024, 1024], 'p');
            pdf.addImage(imgData, 'PNG', 0, 0, 1024, 1024);
        }

        if (currentPageIndex !== originalPageIndex) {
            setCurrentPageIndex(originalPageIndex);
        }

        pdf.save(`manga-comic-${Date.now()}.pdf`);

    } finally {
        if (container) {
            container.classList.remove('pdf-export-mode');
        }
        setIsDownloadingPdf(false);
    }
}, [currentPageIndex, pages, imageContainerRef, setActiveAnnotationId, setIsDownloadingPdf, setEditingTextElementId, setSelectedTextElementId]);

useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setShowHelpModal(false);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

  return (
    <div className="w-full max-w-7xl flex flex-col items-center gap-8 relative">
        {showHelpModal && (
            <div 
                className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4"
                onClick={() => setShowHelpModal(false)}
                style={{ animation: 'fade-in 0.2s ease-out' }}
            >
                <style>{`
                    @keyframes fade-in {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                `}</style>
                <div 
                    className="bg-white p-2 rounded-xl shadow-2xl max-w-3xl w-full relative" 
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="aspect-video w-full">
                        <iframe
                            className="w-full h-full rounded-lg"
                            src="https://www.youtube-nocookie.com/embed/WiyR_L5exbA?si=p3zsTP4GMObLPnm9&amp;controls=0"
                            title="How to use tools"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                        ></iframe>
                    </div>
                     <button 
                        onClick={() => setShowHelpModal(false)} 
                        className="absolute -top-3 -right-3 w-8 h-8 bg-zinc-800 text-white rounded-full flex items-center justify-center hover:bg-zinc-900 transition-colors shadow-lg"
                        aria-label="Close video player"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        )}

        <div className="w-full text-center">
            <h2 className="font-heading text-3xl font-bold text-zinc-900 mb-2">Your Comic</h2>
            <p className="text-zinc-600">Use the tools to add notes, or double-click text to edit. Then regenerate or download.</p>
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

        <div className="w-full flex flex-col lg:flex-row-reverse items-start gap-8 lg:justify-center">
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
                handleShowHelp={() => setShowHelpModal(true)}
            />
            <AnnotationCanvas
                activePage={activePage}
                tool={tool}
                setTool={setTool}
                color={color}
                annotations={annotations}
                setAnnotations={setAnnotations}
                activeAnnotationId={activeAnnotationId}
                setActiveAnnotationId={setActiveAnnotationId}
                eventHandlers={eventHandlers}
                canvasRef={canvasRef}
                imageContainerRef={imageContainerRef}
                onTextUpdate={handleTextUpdate}
                onPositionUpdate={handlePositionUpdate}
                onAnchorUpdate={handleAnchorUpdate}
                onTextDelete={handleTextDelete}
                selectedTextElementId={selectedTextElementId}
                onTextElementSelect={handleTextElementSelect}
                editingTextElementId={editingTextElementId}
                setEditingTextElementId={setEditingTextElementId}
                commitActiveAnnotation={commitActiveAnnotation}
            />
        </div>
    </div>
  );
};
