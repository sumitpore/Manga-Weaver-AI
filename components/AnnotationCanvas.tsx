import React, { useRef, useEffect, RefObject, useCallback } from 'react';
import type { ComicPage, AnnotationObject, Tool, TextAnnotation } from '../types';
import { TextElementDisplay } from './TextElementDisplay';

interface AnnotationCanvasProps {
    activePage: ComicPage;
    tool: Tool | null;
    setTool: (tool: Tool | null) => void;
    color: string;
    annotations: AnnotationObject[];
    setAnnotations: React.Dispatch<React.SetStateAction<AnnotationObject[]>>;
    activeAnnotationId: string | null;
    setActiveAnnotationId: React.Dispatch<React.SetStateAction<string | null>>;
    eventHandlers: {
        onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
        onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
        onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
        onMouseLeave: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    };
    canvasRef: RefObject<HTMLCanvasElement>;
    imageContainerRef: RefObject<HTMLDivElement>;
    onTextUpdate: (elementId: string, newText: string) => void;
    onPositionUpdate?: (elementId: string, newX: string, newY: string) => void;
    onTextDelete?: (elementId: string) => void;
    selectedTextElementId?: string | null;
    onTextElementSelect?: (elementId: string | null) => void;
    editingTextElementId: string | null;
    setEditingTextElementId: (id: string | null) => void;
    commitActiveAnnotation: () => void;
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({ 
    activePage,
    tool,
    setTool,
    color, 
    annotations, 
    setAnnotations,
    activeAnnotationId,
    setActiveAnnotationId,
    eventHandlers, 
    canvasRef, 
    imageContainerRef,
    onTextUpdate,
    onPositionUpdate,
    onTextDelete,
    selectedTextElementId,
    onTextElementSelect,
    editingTextElementId,
    setEditingTextElementId,
    commitActiveAnnotation
}) => {
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    const activeAnnotation = annotations.find(a => a.id === activeAnnotationId) as TextAnnotation | undefined;

    useEffect(() => {
        const img = imageContainerRef.current?.querySelector('img');
        if (img && img.complete) {
            const rect = img.getBoundingClientRect();
            const containerRect = imageContainerRef.current?.getBoundingClientRect();
            console.log(`📐 [Image Dimensions] Natural: ${img.naturalWidth}x${img.naturalHeight}`);
            console.log(`📐 [Image Dimensions] Rendered: ${rect.width}x${rect.height}`);
            console.log(`📐 [Container Dimensions] ${containerRect?.width}x${containerRect?.height}`);
        }
    }, [activePage.imageUrl, imageContainerRef]);

    useEffect(() => {
        if(activeAnnotationId !== null && textInputRef.current) {
            textInputRef.current.focus();
            textInputRef.current.value = activeAnnotation?.text || '';
        }
    }, [activeAnnotationId, activeAnnotation]);

    const handleDeleteButtonClick = (id: string) => {
        setAnnotations(prev => prev.filter(a => a.id !== id));
        setActiveAnnotationId(null);
    };

    const handleAnnotationTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (activeAnnotationId === null) return;
        const newText = e.target.value;
        setAnnotations(prev => prev.map(a => 
            a.id === activeAnnotationId ? { ...a, text: newText } : a
        ));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            commitActiveAnnotation();
        }
    };

    return (
        <div className="flex-grow w-full flex items-center justify-center">
            <div
                ref={imageContainerRef}
                className="relative shadow-2xl rounded-lg border-4 border-zinc-200 flex-shrink-0"
                style={{ width: '1024px', height: '1024px' }}
            >
                <img src={activePage.imageUrl} alt="Generated comic page" className="w-full h-full object-contain rounded-lg" />
                <canvas 
                    ref={canvasRef}
                    {...eventHandlers}
                    className="absolute top-0 left-0 rounded-lg"
                />
                <TextElementDisplay 
                    textElements={activePage.textElements}
                    onUpdate={onTextUpdate}
                    onPositionUpdate={onPositionUpdate}
                    onDelete={onTextDelete}
                    selectedElementId={selectedTextElementId}
                    onSelect={onTextElementSelect}
                    editingId={editingTextElementId}
                    onSetEditing={setEditingTextElementId}
                />
                {activeAnnotation && (
                    <div
                        ref={editorRef}
                        style={{
                            position: 'absolute',
                            left: `${activeAnnotation.x}px`,
                            top: `${activeAnnotation.y}px`,
                            transform: 'translate(-50%, 8px)',
                            zIndex: 10,
                        }}
                    >
                        <textarea
                            ref={textInputRef}
                            defaultValue={activeAnnotation.text}
                            onChange={handleAnnotationTextChange}
                            onKeyDown={handleKeyDown}
                            onBlur={commitActiveAnnotation}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: `1px solid ${activeAnnotation.color}`,
                                color: '#18181b',
                                outline: 'none',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '16px',
                                padding: '8px',
                                borderRadius: '6px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                minWidth: '200px',
                                minHeight: '50px',
                                resize: 'none',
                            }}
                        />
                         <div style={{ position: 'absolute', top: '-10px', right: '-28px', display: 'flex', gap: '6px', zIndex: 11 }}>
                            <button
                                 onMouseDown={(e) => {
                                     e.preventDefault();
                                     commitActiveAnnotation();
                                 }}
                                 aria-label="Close editor"
                                 title="Close"
                                 style={{
                                     width: '24px',
                                     height: '24px',
                                     borderRadius: '50%',
                                     backgroundColor: '#4b5563', // gray-600
                                     color: 'white',
                                     border: '2px solid white',
                                     display: 'flex',
                                     alignItems: 'center',
                                     justifyContent: 'center',
                                     cursor: 'pointer',
                                     fontSize: '16px',
                                     fontWeight: 'bold',
                                     lineHeight: '1',
                                     boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                                 }}
                            >
                                &times;
                            </button>
                             <button
                                 onMouseDown={(e) => {
                                     e.preventDefault();
                                     handleDeleteButtonClick(activeAnnotation.id);
                                 }}
                                 aria-label="Delete annotation"
                                 title="Delete"
                                 style={{
                                     width: '24px',
                                     height: '24px',
                                     borderRadius: '50%',
                                     backgroundColor: '#ef4444', // red-500
                                     color: 'white',
                                     border: '2px solid white',
                                     display: 'flex',
                                     alignItems: 'center',
                                     justifyContent: 'center',
                                     cursor: 'pointer',
                                     boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                                 }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};