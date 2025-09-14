import type { AnnotationObject, ShapeObject } from '../types';

const ANNOTATION_RADIUS = 15;
const HANDLE_SIZE = 8;

export const isPointInShape = (point: { x: number; y: number }, shape: AnnotationObject): boolean => {
  if (shape.type === 'text') {
    const distance = Math.sqrt(Math.pow(point.x - shape.x, 2) + Math.pow(point.y - shape.y, 2));
    return distance < ANNOTATION_RADIUS;
  }
  
  if (shape.type === 'arrow') {
      const [x1, y1, x2, y2] = shape.points;
      // Check distance from the line segment
      const dist = Math.abs((y2 - y1) * point.x - (x2 - x1) * point.y + x2 * y1 - y2 * x1) / Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
      
      // Check if the point is within the bounding box of the line segment (with some tolerance)
      const buffer = 5;
      const inX = point.x >= Math.min(x1, x2) - buffer && point.x <= Math.max(x1, x2) + buffer;
      const inY = point.y >= Math.min(y1, y2) - buffer && point.y <= Math.max(y1, y2) + buffer;
      
      return dist < 5 && inX && inY;
  }

  // For rectangle and circle, use the bounding box
  return (
    point.x >= shape.x &&
    point.x <= shape.x + shape.width &&
    point.y >= shape.y &&
    point.y <= shape.y + shape.height
  );
};

export const getResizeHandle = (shape: ShapeObject) => {
    const { x, y, width, height } = shape;
    if (shape.type === 'arrow') {
        const [x1, y1, x2, y2] = shape.points;
        return {
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
        };
    }
    return {
        tl: { x: x, y: y },
        tr: { x: x + width, y: y },
        bl: { x: x, y: y + height },
        br: { x: x + width, y: y + height },
    };
};

export const getCursorForPosition = (point: {x: number, y: number}, shape: AnnotationObject) => {
    const handles = getResizeHandle(shape as ShapeObject); // Cast because text nodes don't have handles in the same way
    
    for (const [key, value] of Object.entries(handles)) {
        if (Math.abs(point.x - value.x) < HANDLE_SIZE / 2 && Math.abs(point.y - value.y) < HANDLE_SIZE / 2) {
            if (shape.type === 'arrow') return 'grab';
            if (key === 'tl' || key === 'br') return 'nwse-resize';
            if (key === 'tr' || key === 'bl') return 'nesw-resize';
        }
    }

    if (isPointInShape(point, shape)) return 'move';
    
    return null;
}