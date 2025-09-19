import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { TextElement } from '../types';
import { parsePx } from '../utils/canvas';

interface TextElementDisplayProps {
    textElements: TextElement[];
    onUpdate: (elementId: string, newText: string) => void;
    onPositionUpdate?: (elementId: string, newX: string, newY: string) => void;
    onAnchorUpdate?: (elementId: string, newAnchor: { x: string; y: string }) => void;
    onDelete?: (elementId: string) => void;
    selectedElementId?: string | null;
    onSelect?: (elementId: string | null) => void;
    editingId: string | null;
    onSetEditing: (id: string | null) => void;
}

const typeToClassMap = {
    dialogue: 'speech',
    narrative: 'narration',
    thoughts: 'thought',
};

const EditorTextarea: React.FC<{
    element: TextElement;
    onUpdate: (newText: string) => void;
    onClose: () => void;
}> = ({ element, onUpdate, onClose }) => {
    const [text, setText] = useState(element.text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const initialText = useRef(element.text);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, []);
    
    const handleBlur = () => {
        if (text !== initialText.current) {
          onUpdate(text);
        }
        onClose();
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.blur();
        }
    };

    return (
        <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="text-element-textarea"
            // Stop clicks inside the editor from propagating to the drag handler
            onMouseDown={(e) => e.stopPropagation()}
        />
    );
};


export const TextElementDisplay: React.FC<TextElementDisplayProps> = ({ 
    textElements, 
    onUpdate, 
    onPositionUpdate,
    onAnchorUpdate,
    onDelete, 
    selectedElementId, 
    onSelect,
    editingId,
    onSetEditing
}) => {
    const [tailPaths, setTailPaths] = useState<Array<{ id: string; d: string; type: 'tail' | 'thought_bubble' }>>([]);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState<{ x: number; y: number; elementX: number; elementY: number } | null>(null);
    const [draggingAnchor, setDraggingAnchor] = useState<{ elementId: string; startMouseX: number; startMouseY: number; startAnchorX: number; startAnchorY: number; } | null>(null);
    const bubbleRefs = useRef(new Map<string, HTMLDivElement>());
    const containerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const newPaths: Array<{ id: string; d: string; type: 'tail' | 'thought_bubble' }> = [];
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        for (const el of textElements) {
            const node = bubbleRefs.current.get(el.id);
            if (!node || !el.anchor) continue;

            const bubbleRect = node.getBoundingClientRect();

            const anchor = { x: parsePx(el.anchor.x), y: parsePx(el.anchor.y) };
            const bubble = {
                x: bubbleRect.left - containerRect.left,
                y: bubbleRect.top - containerRect.top,
                width: bubbleRect.width,
                height: bubbleRect.height
            };

            const bubbleCenterX = bubble.x + bubble.width / 2;
            const bubbleCenterY = bubble.y + bubble.height / 2;

            if (el.type === 'dialogue') {
                const dx = anchor.x - bubbleCenterX;
                const dy = anchor.y - bubbleCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 10) continue;

                let edgeX = 0, edgeY = 0;
                const intersections = [];
                if (dy !== 0) {
                    const t_top = (bubble.y - bubbleCenterY) / dy;
                    if (t_top > 0) {
                        const x = bubbleCenterX + dx * t_top;
                        if (x >= bubble.x && x <= bubble.x + bubble.width) intersections.push({ x, y: bubble.y, t: t_top });
                    }
                    const t_bottom = (bubble.y + bubble.height - bubbleCenterY) / dy;
                    if (t_bottom > 0) {
                        const x = bubbleCenterX + dx * t_bottom;
                        if (x >= bubble.x && x <= bubble.x + bubble.width) intersections.push({ x, y: bubble.y + bubble.height, t: t_bottom });
                    }
                }
                if (dx !== 0) {
                    const t_left = (bubble.x - bubbleCenterX) / dx;
                    if (t_left > 0) {
                        const y = bubbleCenterY + dy * t_left;
                        if (y >= bubble.y && y <= bubble.y + bubble.height) intersections.push({ x: bubble.x, y, t: t_left });
                    }
                    const t_right = (bubble.x + bubble.width - bubbleCenterX) / dx;
                     if (t_right > 0) {
                        const y = bubbleCenterY + dy * t_right;
                        if (y >= bubble.y && y <= bubble.y + bubble.height) intersections.push({ x: bubble.x + bubble.width, y, t: t_right });
                    }
                }
                
                if (intersections.length > 0) {
                    const closest = intersections.reduce((min, curr) => curr.t < min.t ? curr : min);
                    edgeX = closest.x;
                    edgeY = closest.y;
                } else { continue; }
                
                const tailWidth = 20;
                let p1, p2;
                if (Math.abs(edgeY - bubble.y) < 1 || Math.abs(edgeY - (bubble.y + bubble.height)) < 1) { // Top or bottom edge
                    p1 = { x: Math.max(bubble.x + 5, edgeX - tailWidth / 2), y: edgeY };
                    p2 = { x: Math.min(bubble.x + bubble.width - 5, edgeX + tailWidth / 2), y: edgeY };
                } else { // Left or right edge
                    p1 = { x: edgeX, y: Math.max(bubble.y + 5, edgeY - tailWidth / 2) };
                    p2 = { x: edgeX, y: Math.min(bubble.y + bubble.height - 5, edgeY + tailWidth / 2) };
                }
                
                const d = `M${anchor.x},${anchor.y} L${p1.x},${p1.y} L${p2.x},${p2.y} Z`;
                newPaths.push({ id: el.id, d, type: 'tail' });

            } else if (el.type === 'thoughts') {
                const a = bubble.width / 2;
                const b = bubble.height * 0.4;
                if (a <= 0 || b <= 0) continue;

                const dx = anchor.x - bubbleCenterX;
                const dy = anchor.y - bubbleCenterY;
                
                if (dx === 0 && dy === 0) continue;

                const t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
                const edgePoint = {
                    x: bubbleCenterX + t * dx,
                    y: bubbleCenterY + t * dy,
                };

                const gap = 4;
                const r1 = 10;
                const r2 = 6;
                
                const totalDist = Math.sqrt(dx * dx + dy * dy);
                if (totalDist === 0) continue;
                
                const normDx = dx / totalDist;
                const normDy = dy / totalDist;

                const dist_to_c1_center = gap + r1;
                const c1 = {
                    x: edgePoint.x + normDx * dist_to_c1_center,
                    y: edgePoint.y + normDy * dist_to_c1_center,
                    r: r1
                };

                const dist_between_centers = r1 + gap + r2;
                const c2 = {
                    x: c1.x + normDx * dist_between_centers,
                    y: c1.y + normDy * dist_between_centers,
                    r: r2
                };

                const path1 = `M ${c1.x - c1.r},${c1.y} a ${c1.r},${c1.r} 0 1,1 ${c1.r * 2},0 a ${c1.r},${c1.r} 0 1,1 -${c1.r * 2},0`;
                const path2 = `M ${c2.x - c2.r},${c2.y} a ${c2.r},${c2.r} 0 1,1 ${c2.r * 2},0 a ${c2.r},${c2.r} 0 1,1 -${c2.r * 2},0`;

                newPaths.push({ id: `${el.id}_t1`, d: path1, type: 'thought_bubble' });
                newPaths.push({ id: `${el.id}_t2`, d: path2, type: 'thought_bubble' });
            }
        }
        
        setTailPaths(newPaths);
    }, [textElements, editingId]);

    const handleDoubleClick = (id: string) => onSetEditing(id);
    const handleUpdate = (id: string, newText: string) => onUpdate(id, newText);
    
    const handleCloseEditor = () => {
        onSetEditing(null);
    };

    const handleDelete = (id: string) => {
        if (onDelete) {
            onDelete(id);
        }
        onSetEditing(null);
    };

    const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
        // If an editor is open, a click outside should close it.
        if (editingId) {
            const editorContainer = bubbleRefs.current.get(editingId);
            // If the click is on the element being edited, let the editor handle it.
            if (editingId === elementId) {
                e.stopPropagation();
                return;
            }
            // Otherwise, blur the active editor.
            const textarea = editorContainer?.querySelector('textarea');
            if (textarea) {
                textarea.blur();
            } else {
                // Fallback to ensure editor state is cleared
                onSetEditing(null);
            }
        }
    
        const element = textElements.find(el => el.id === elementId);
        if (!element) {
            return; // Element not found, do nothing.
        }
        
        // For ALL elements, we want to select them and prevent default text selection.
        e.preventDefault();
        if (onSelect) {
            onSelect(elementId);
        }
        
        // All elements are draggable. Set up dragging.
        setDraggingId(elementId);
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            elementX: parsePx(element.x),
            elementY: parsePx(element.y)
        });
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        const scaleX = 1024 / containerRect.width;
        const scaleY = 1024 / containerRect.height;
        
        if (draggingId && dragStart) {
            const deltaX = (e.clientX - dragStart.x) * scaleX;
            const deltaY = (e.clientY - dragStart.y) * scaleY;
            const newX = dragStart.elementX + deltaX;
            const newY = dragStart.elementY + deltaY;
            if (onPositionUpdate) {
                onPositionUpdate(draggingId, `${newX}px`, `${newY}px`);
            }
        } else if (draggingAnchor) {
            if (!onAnchorUpdate) return;
            const deltaX = (e.clientX - draggingAnchor.startMouseX) * scaleX;
            const deltaY = (e.clientY - draggingAnchor.startMouseY) * scaleY;
            const newX = draggingAnchor.startAnchorX + deltaX;
            const newY = draggingAnchor.startAnchorY + deltaY;
            const clampedX = Math.max(0, Math.min(1024, newX));
            const clampedY = Math.max(0, Math.min(1024, newY));
            onAnchorUpdate(draggingAnchor.elementId, { x: `${clampedX}px`, y: `${clampedY}px` });
        }
    }, [draggingId, dragStart, draggingAnchor, onPositionUpdate, onAnchorUpdate]);

    const handleMouseUp = useCallback(() => {
        setDraggingId(null);
        setDragStart(null);
        setDraggingAnchor(null);
    }, []);

    useEffect(() => {
        if (draggingId || draggingAnchor) {
            document.body.style.cursor = draggingId ? 'move' : 'grabbing';
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp, { once: true });
            return () => {
                document.body.style.cursor = '';
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [draggingId, draggingAnchor, handleMouseMove, handleMouseUp]);

    return (
        <div 
            ref={containerRef} 
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
        >
            <svg width="100%" height="100%" className="absolute top-0 left-0" style={{ overflow: 'visible' }}>
                {tailPaths.map(p => (
                    <path
                        key={p.id}
                        d={p.d}
                        className="speech-tail-path"
                        stroke="#18181b"
                        strokeWidth="2"
                        strokeDasharray={p.type === 'thought_bubble' ? '4 4' : 'none'}
                    />
                ))}
                {textElements.map(el => {
                    if (el.type === 'dialogue' && el.anchor && selectedElementId === el.id) {
                        const anchorX = parsePx(el.anchor.x);
                        const anchorY = parsePx(el.anchor.y);
                        return (
                            <g
                                key={`${el.id}-anchor`}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    const currentElement = textElements.find(elem => elem.id === el.id);
                                    if (!currentElement?.anchor) return;
                                    setDraggingAnchor({
                                        elementId: el.id,
                                        startMouseX: e.clientX,
                                        startMouseY: e.clientY,
                                        startAnchorX: parsePx(currentElement.anchor.x),
                                        startAnchorY: parsePx(currentElement.anchor.y)
                                    });
                                }}
                                className="pointer-events-auto"
                                style={{ cursor: 'grab' }}
                            >
                                {/* FIX: Replaced unsupported 'title' attribute on SVG <g> with a nested <title> element for tooltips. */}
                                <title>Drag to move speech bubble anchor</title>
                                <circle cx={anchorX} cy={anchorY} r="10" fill="rgba(59, 130, 246, 0.3)" />
                                <circle cx={anchorX} cy={anchorY} r="6" fill="rgba(59, 130, 246, 0.8)" stroke="#fff" strokeWidth="2" />
                            </g>
                        );
                    }
                    return null;
                })}
            </svg>
            {textElements.map(el => {
                const isSelected = selectedElementId === el.id;
                const isEditing = editingId === el.id;
                const isDialogueWithAnchor = el.type === 'dialogue' && el.anchor;

                const cursorClass = isEditing ? 'cursor-text' : 'cursor-move';
                
                let title = "Click to select, drag to move, double-click to edit.";
                if (isDialogueWithAnchor) {
                    title = "Click to select, drag to move, double-click to edit. Drag the blue circle to move the tail.";
                }

                return (
                    <div
                        key={el.id}
                        ref={node => {
                            if (node) bubbleRefs.current.set(el.id, node);
                            else bubbleRefs.current.delete(el.id);
                        }}
                        className={`text-element ${typeToClassMap[el.type]} pointer-events-auto ${draggingId === el.id ? 'opacity-80 scale-105 shadow-xl' : isSelected ? 'shadow-lg ring-2 ring-blue-400' : 'hover:shadow-lg'} transition-all duration-150 relative ${cursorClass}`}
                        style={{
                            top: el.y,
                            left: el.x,
                            userSelect: 'none',
                        }}
                        onMouseDown={(e) => handleMouseDown(e, el.id)}
                        onDoubleClick={() => handleDoubleClick(el.id)}
                        title={title}
                    >
                        {isEditing ? (
                           <EditorTextarea 
                                element={el}
                                onUpdate={(newText) => handleUpdate(el.id, newText)}
                                onClose={handleCloseEditor}
                            />
                        ) : (
                           el.text.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)
                        )}
                         
                        {isSelected && !isEditing && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(el.id);
                                }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg z-10 transition-colors"
                                title="Delete text element"
                                aria-label="Delete text element"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="m15 9-6 6" />
                                    <path d="m9 9 6 6" />
                                </svg>
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};