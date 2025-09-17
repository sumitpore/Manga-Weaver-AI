import { useState, useRef, useEffect, useCallback } from 'react';
import type { Tool, AnnotationObject, ShapeObject, TextAnnotation, Arrow } from '../types';
import { isPointInShape, getResizeHandle, getCursorForPosition } from '../utils/canvas';
import { nanoid } from 'nanoid';

const ANNOTATION_RADIUS = 15;
const HANDLE_SIZE = 8;

type Action = 'none' | 'drawing' | 'moving' | 'resizing';
type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'start' | 'end';

export const useAnnotations = (
  imageUrl: string, 
  editingTextElementId: string | null
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  const [tool, setTool] = useState<Tool | null>(null);
  const [color, setColor] = useState('#ef4444');
  const [annotations, setAnnotations] = useState<AnnotationObject[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [action, setAction] = useState<Action>('none');
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);

  const [history, setHistory] = useState<AnnotationObject[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const startPoint = useRef({ x: 0, y: 0 });
  const currentAnnotations = useRef<AnnotationObject[]>([]);

  useEffect(() => {
    currentAnnotations.current = annotations;
  }, [annotations]);

  const hasAnnotations = annotations.length > 0;

  const pushToHistory = useCallback((newAnnotations: AnnotationObject[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setAnnotations(history[newIndex]);
      setHistoryIndex(newIndex);
    } else { // also handles historyIndex === 0
      setAnnotations([]);
      setHistory([]);
      setHistoryIndex(-1);
    }
    setSelectedId(null);
    setActiveAnnotationId(null);
  };

  const drawAnnotations = useCallback(() => {
    if (!contextRef.current || !canvasRef.current) return;
    const ctx = contextRef.current;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    annotations.forEach(ann => {
      ctx.save();
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = 4;
      switch (ann.type) {
        case 'rectangle':
          ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
          break;
        case 'circle':
          ctx.beginPath();
          ctx.ellipse(ann.x + ann.width / 2, ann.y + ann.height / 2, Math.abs(ann.width / 2), Math.abs(ann.height / 2), 0, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        case 'arrow':
          drawArrow(ctx, ann.points[0], ann.points[1], ann.points[2], ann.points[3]);
          break;
        case 'text':
           // Do not draw the pin for the currently active text editor
           if (ann.id === activeAnnotationId) return;
           drawTextPin(ctx, ann);
           break;
      }
      ctx.restore();
    });

    const selectedAnn = annotations.find(a => a.id === selectedId);
    if (selectedAnn) {
        drawSelection(ctx, selectedAnn);
    }

  }, [annotations, selectedId, activeAnnotationId]);
  
  const drawTextPin = (ctx: CanvasRenderingContext2D, ann: TextAnnotation) => {
        ctx.save();
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.beginPath();
        ctx.arc(ann.x, ann.y, ANNOTATION_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = ann.color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'white';
        const number = annotations.filter(a => a.type === 'text').findIndex(a => a.id === ann.id) + 1;
        ctx.fillText(String(number), ann.x, ann.y + 1);
        ctx.restore();
  }
  
  const drawArrow = (ctx: CanvasRenderingContext2D, fromx: number, fromy: number, tox: number, toy: number) => {
    const headlen = 10;
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(tox, toy);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  };

  const drawSelection = (ctx: CanvasRenderingContext2D, ann: AnnotationObject) => {
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;

    if (ann.type === 'text') {
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(ann.x, ann.y, ANNOTATION_RADIUS + 4, 0, 2 * Math.PI);
      ctx.stroke();
    } else {
      ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
      Object.entries(getResizeHandle(ann)).forEach(([key, value]) => {
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.fillRect(value.x - HANDLE_SIZE/2, value.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeRect(value.x - HANDLE_SIZE/2, value.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
      });
    }
    
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageContainerRef.current) return;
    const container = imageContainerRef.current;
    
    const resizeObserver = new ResizeObserver(entries => {
      for(const entry of entries) {
        if(entry.target === container) {
            const { width, height } = entry.contentRect;
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            if (!context) return;
            contextRef.current = context;
            drawAnnotations();
        }
      }
    });
    
    resizeObserver.observe(container);
    return () => resizeObserver.unobserve(container);
  }, [drawAnnotations]);

  useEffect(() => {
    drawAnnotations();
  }, [annotations, selectedId, activeAnnotationId, drawAnnotations]);
  
  const clearCanvas = useCallback(() => {
      setAnnotations([]);
      setSelectedId(null);
      setActiveAnnotationId(null);
      setHistory([]);
      setHistoryIndex(-1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            return;
        }

        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
            const newAnnotations = currentAnnotations.current.filter(ann => ann.id !== selectedId);
            setAnnotations(newAnnotations);
            pushToHistory(newAnnotations);
            setSelectedId(null);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, pushToHistory]);

  const commitActiveAnnotation = useCallback(() => {
    const idToCommit = activeAnnotationId;
    if (!idToCommit) return;

    setAnnotations(prevAnnotations => {
        const annotationToCommit = prevAnnotations.find(a => a.id === idToCommit);
        // If the annotation is empty, remove it.
        if (annotationToCommit && annotationToCommit.type === 'text' && annotationToCommit.text.trim() === '') {
            return prevAnnotations.filter(a => a.id !== idToCommit);
        }
        return prevAnnotations;
    });
    
    // Close the editor and deselect the tool.
    setActiveAnnotationId(null);
    setTool(null);
  }, [activeAnnotationId, setAnnotations, setActiveAnnotationId, setTool]);

  const startDrawing = ({ nativeEvent }: React.MouseEvent<HTMLCanvasElement>) => {
    // Priority 1: An external text element (speech bubble) editor is active.
    // A click on the canvas should just blur that element. We return early and
    // DON'T call preventDefault() to allow the browser's native blur behavior,
    // which will trigger the save logic in the editor component.
    if (editingTextElementId) {
        return;
    }

    nativeEvent.preventDefault();
    const { offsetX, offsetY } = nativeEvent;

    // Priority 2: An internal text annotation editor is active.
    // This click on the canvas background should commit it.
    const activeAnn = currentAnnotations.current.find(a => a.id === activeAnnotationId);
    if (activeAnn && activeAnn.type === 'text') {
        commitActiveAnnotation();
        return;
    }

    // --- Normal Click Logic from here ---

    startPoint.current = { x: offsetX, y: offsetY };
    
    const previouslyActiveId = activeAnnotationId;
    const clickedAnn = currentAnnotations.current.slice().reverse().find(ann => isPointInShape({ x: offsetX, y: offsetY }, ann));

    if (clickedAnn) {
        if (clickedAnn.type === 'text') {
            if (clickedAnn.id !== previouslyActiveId) {
                commitActiveAnnotation(); // Commit any other active text annotation
                setActiveAnnotationId(clickedAnn.id);
            }
        } else {
            commitActiveAnnotation();
        }
        setSelectedId(clickedAnn.id);
        setAction('moving');
        return;
    }
    
    commitActiveAnnotation(); // Commit any active text annotation if clicking on empty space

    const selectedAnn = currentAnnotations.current.find(a => a.id === selectedId);
    if (selectedAnn && selectedAnn.type !== 'text') {
        const cursor = getCursorForPosition({ x: offsetX, y: offsetY }, selectedAnn);
        if (cursor && cursor !== 'move') {
            setAction('resizing');
            const handles = getResizeHandle(selectedAnn as ShapeObject);
            const handleKey = Object.keys(handles).find(key => {
                const handle = handles[key as keyof typeof handles];
                return Math.abs(offsetX - handle.x) < HANDLE_SIZE / 2 && Math.abs(offsetY - handle.y) < HANDLE_SIZE / 2
            })
            setResizeHandle(handleKey as ResizeHandle);
            return;
        }
    }

    setSelectedId(null);

    if (!tool) {
        setAction('none');
        return;
    }

    if (tool === 'text') {
        const newAnnotation: TextAnnotation = {
            id: nanoid(), x: offsetX, y: offsetY, color, type: 'text', text: ''
        };
        const finalAnnotations = [...currentAnnotations.current, newAnnotation];
        setAnnotations(finalAnnotations);
        pushToHistory(finalAnnotations);

        setActiveAnnotationId(newAnnotation.id);
        setSelectedId(newAnnotation.id);
        setAction('none');

    } else {
        setAction('drawing');
        const newAnnotation: ShapeObject = {
            id: nanoid(), x: offsetX, y: offsetY, color,
            ...(tool === 'arrow' ? { type: 'arrow', width: 0, height: 0, points: [offsetX, offsetY, offsetX, offsetY] }
            : { type: tool, width: 0, height: 0 })
        };
        setAnnotations(prev => [...prev, newAnnotation]);
        setSelectedId(newAnnotation.id);
    }
  };

  const draw = ({ nativeEvent }: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = nativeEvent.currentTarget as HTMLCanvasElement;
    const { offsetX, offsetY } = nativeEvent;

    if (action === 'none') {
        const hoveredAnn = annotations.slice().reverse().find(ann => isPointInShape({x: offsetX, y: offsetY}, ann));
        const cursor = hoveredAnn ? getCursorForPosition({x: offsetX, y: offsetY}, hoveredAnn) : null;
        
        if (cursor) {
            canvas.style.cursor = cursor;
        } else if (tool) {
            canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
        } else {
            canvas.style.cursor = 'default';
        }
        return;
    }
    
    const dx = offsetX - startPoint.current.x;
    const dy = offsetY - startPoint.current.y;
    
    setAnnotations(prev => prev.map(ann => {
        if (ann.id !== selectedId) return ann;
        
        if (action === 'moving') {
             if (ann.type === 'arrow') {
                const newPoints: [number, number, number, number] = [ann.points[0] + dx, ann.points[1] + dy, ann.points[2] + dx, ann.points[3] + dy];
                return { ...ann, x: ann.x + dx, y: ann.y + dy, points: newPoints };
             }
             return { ...ann, x: ann.x + dx, y: ann.y + dy };
        } 
        
        if (action === 'drawing' && ann.type !== 'text') {
            if (ann.type === 'arrow') {
               const newPoints: [number, number, number, number] = [startPoint.current.x, startPoint.current.y, offsetX, offsetY];
               return {...ann, points: newPoints};
            }
            return { ...ann, width: dx, height: dy };
        }

        if (action === 'resizing' && ann.type !== 'text' && resizeHandle) {
             let { x, y, width, height } = ann as ShapeObject;
             if(ann.type === 'arrow') {
                 let [x1, y1, x2, y2] = ann.points;
                 if(resizeHandle === 'start') { x1 = offsetX; y1 = offsetY; }
                 if(resizeHandle === 'end') { x2 = offsetX; y2 = offsetY; }
                 return {...ann, points: [x1, y1, x2, y2]};
             } else {
                 switch (resizeHandle) {
                    case 'tl': x = offsetX; y = offsetY; width -= dx; height -= dy; break;
                    case 'tr': y = offsetY; width = offsetX - x; height -= dy; break;
                    case 'bl': x = offsetX; width -= dx; height = offsetY - y; break;
                    case 'br': width = offsetX - x; height = offsetY - y; break;
                }
                return {...ann, x, y, width, height};
             }
        }
        
        return ann;
    }));
    
    if (action === 'moving') {
       startPoint.current = { x: offsetX, y: offsetY };
    }
  };

  const finishDrawing = () => {
    if (action === 'none') return;
    
    const wasDrawing = action === 'drawing';

    const finalAnnotations = currentAnnotations.current.map(ann => {
        if (ann.id !== selectedId) return ann;
        
        if (ann.type === 'arrow') {
            const [x1, y1, x2, y2] = ann.points;
            ann.x = Math.min(x1, x2);
            ann.y = Math.min(y1, y2);
            ann.width = Math.abs(x1 - x2);
            ann.height = Math.abs(y1 - y2);
        }
        else if (ann.type !== 'text') {
            if (ann.width < 0) {
                ann.x += ann.width;
                ann.width *= -1;
            }
            if (ann.height < 0) {
                ann.y += ann.height;
                ann.height *= -1;
            }
        }
        return ann;
    });

    setAnnotations(finalAnnotations);
    pushToHistory(finalAnnotations);
    setAction('none');
    setResizeHandle(null);

    if (wasDrawing) {
      setTool(null);
    }
  };
  
  const getAnnotatedImage = async (includeAnnotations = true): Promise<string | null> => {
     setSelectedId(null);
     setActiveAnnotationId(null);

     await new Promise(resolve => requestAnimationFrame(resolve));

     return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return resolve(null);
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.naturalWidth;
            tempCanvas.height = img.naturalHeight;
            const ctx = tempCanvas.getContext('2d');
            if (!ctx) return resolve(null);

            ctx.drawImage(img, 0, 0);

            if (includeAnnotations) {
                ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
            }
            
            resolve(tempCanvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
        img.src = imageUrl;
     });
  };

  return {
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
    eventHandlers: {
      onMouseDown: startDrawing,
      onMouseUp: finishDrawing,
      onMouseMove: draw,
      onMouseLeave: finishDrawing,
    },
    clearCanvas,
    handleUndo,
    getAnnotatedImage,
    commitActiveAnnotation
  };
};