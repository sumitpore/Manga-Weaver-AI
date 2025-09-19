export interface TextElement {
  id: string;
  x: string; // e.g., "120px"
  y: string; // e.g., "120px"
  type: 'dialogue' | 'narrative' | 'thoughts';
  text: string;
  anchor?: { x: string; y: string }; // Optional anchor for speech bubble tails
}

export interface ComicPage {
  id:string;
  imageUrl: string; // base64 data URL
  textElements: TextElement[];
  storyPrompt: StoryPagePrompt;
}

export type AppStatus = 'idle' | 'loading' | 'editing';

export interface PageProgress {
    pageNum: number;
    message: string;
    progress: number; // 0-100 for this page specifically
}

export interface ProgressUpdate {
  message: string;
  progress: number; // This will be the overall progress from 0-100
  stage: 'outline' | 'pages' | 'finalizing';
  pageDetails?: PageProgress[]; // Optional details for each page, used in the 'pages' stage
}

export type ProgressCallback = (update: ProgressUpdate) => void;

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
export interface TextElementData {
    type: 'dialogue' | 'narrative' | 'thoughts';
    text: string;
    character_identifier?: string;
}

export interface ComicPanelPrompt {
    panel_number: number;
    visual_description: string;
    text_elements: TextElementData[];
}

export interface StoryPagePrompt {
    page_number: number;
    panels: ComicPanelPrompt[];
}

export interface StoryOutline {
    pages: StoryPagePrompt[];
}
