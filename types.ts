export interface ComicPage {
  id:string;
  imageUrl: string; // base64 data URL
}

export type AppStatus = 'idle' | 'loading' | 'editing';

export type Tool = 'arrow' | 'rectangle' | 'circle' | 'text';

// Base interfaces for annotations
interface AnnotationBase {
  id: string;
  x: number;
  y: number;
  color: string;
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  text: string;
}

// Shape interfaces
interface Shape extends AnnotationBase {
  width: number;
  height: number;
}

export interface Arrow extends Shape {
  type: 'arrow';
  points: [number, number, number, number]; // [startX, startY, endX, endY]
}

export interface Rectangle extends Shape {
  type: 'rectangle';
}

export interface Circle extends Shape {
  type: 'circle';
}

export type ShapeObject = Arrow | Rectangle | Circle;

export type AnnotationObject = ShapeObject | TextAnnotation;

// Types for structured story generation
export interface StoryPagePrompt {
    page_number: number;
    visual_prompt: string;
}

export interface StoryOutline {
    pages: StoryPagePrompt[];
}
