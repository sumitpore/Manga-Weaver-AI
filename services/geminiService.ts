import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import type { ComicPage } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export const generateInitialComic = async (prompt: string, files: File[]): Promise<ComicPage> => {
    const model = 'gemini-2.5-flash-image-preview';

    let fullPrompt = `Create a single-page manga/anime comic panel in a portrait aspect ratio (4:5). The style should be modern anime. Story idea: "${prompt}"`;

    if (files.length > 0) {
        fullPrompt += "\n\nUse the following uploaded image(s) as character references.";
    }

    const imageParts = await Promise.all(files.map(fileToGenerativePart));
    const textPart = { text: fullPrompt };
    
    const contents = { parts: [textPart, ...imageParts] };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents,
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            const imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
            return {
                id: `page-${Date.now()}`,
                imageUrl,
            };
        }
    }

    throw new Error("AI did not return an image. Please try a different prompt.");
};

export const regeneratePage = async (annotatedImageB64: string, annotationText: string): Promise<Omit<ComicPage, 'id'>> => {
    const model = 'gemini-2.5-flash-image-preview';
    const mimeType = annotatedImageB64.substring(annotatedImageB64.indexOf(":") + 1, annotatedImageB64.indexOf(";"));
    const data = annotatedImageB64.split(',')[1];
    
    const basePrompt = 'Incorporate the changes described by the annotations (drawings, arrows, shapes, etc.) on this image. Maintain the manga style and a portrait aspect ratio (4:5). Crucially, remove the annotation drawings, text, and shapes from the final image output, leaving only the modified comic art.';
    
    let fullPrompt = basePrompt;
    if (annotationText) {
        fullPrompt += `\n\nAdditionally, apply these text-based instructions, which correspond to the numbered points on the image:\n${annotationText}`;
    }

    const contents = {
        parts: [
            {
                inlineData: { data, mimeType },
            },
            {
                text: fullPrompt,
            },
        ],
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents,
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            const imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
            return { imageUrl };
        }
    }

    throw new Error("AI could not regenerate the image. Please try again.");
};