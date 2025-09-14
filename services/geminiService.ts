import { GoogleGenAI, Modality, GenerateContentResponse, Type } from "@google/genai";
import type { ComicPage, StoryOutline } from '../types';
import { nanoid } from 'nanoid';

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

const generateStoryOutline = async (prompt: string, numPages: number, hasCharacterFiles: boolean): Promise<StoryOutline> => {
    const characterPrompt = hasCharacterFiles
        ? "The user has provided reference images for the main character(s). Ensure your descriptions are consistent with these visual references."
        : "The user has not provided character reference images. You must create and maintain a consistent visual description for all main characters throughout the story.";

    const systemInstruction = `You are a master storyteller and manga scriptwriter. Your task is to break down a user's story idea into a page-by-page script for a manga. For each page, you must provide a detailed visual description that an AI artist can use to generate an image. The descriptions should be vivid, focusing on character actions, expressions, setting, and camera angles. Ensure character consistency across all pages.`;

    const userPrompt = `
        Story Idea: "${prompt}"
        Number of Pages: ${numPages}
        ${characterPrompt}

        Generate a JSON object that contains a list of page-by-page visual prompts.
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    pages: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                page_number: { type: Type.INTEGER },
                                visual_prompt: { type: Type.STRING },
                            },
                        },
                    },
                },
            },
        },
    });

    try {
        const jsonText = response.text.trim();
        const parsed = JSON.parse(jsonText);
        // Basic validation
        if (parsed.pages && Array.isArray(parsed.pages)) {
            return parsed as StoryOutline;
        }
        throw new Error("Invalid story outline format received from AI.");
    } catch (e) {
        console.error("Failed to parse story outline JSON:", e);
        throw new Error("The AI failed to generate a valid story outline. Please try a different prompt.");
    }
}

const generateImageForPage = async (visualPrompt: string, imageParts: any[]): Promise<string> => {
     const model = 'gemini-2.5-flash-image-preview';

    let fullPrompt = `Generate a single manga/anime comic panel in a portrait aspect ratio (4:5). The style should be modern anime. Visual Description: "${visualPrompt}"`;

    if (imageParts.length > 0) {
        fullPrompt += "\n\nUse the following uploaded image(s) as character references to maintain consistency.";
    }
    
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
            return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
    }
    throw new Error(`AI did not return an image for prompt: "${visualPrompt}"`);
}

export const generateComicStory = async (prompt: string, files: File[], numPages: number): Promise<ComicPage[]> => {
    const storyOutline = await generateStoryOutline(prompt, numPages, files.length > 0);
    const imageParts = await Promise.all(files.map(fileToGenerativePart));
    
    const comicPages: ComicPage[] = [];

    for(const pagePrompt of storyOutline.pages) {
        const imageUrl = await generateImageForPage(pagePrompt.visual_prompt, imageParts);
        comicPages.push({
            id: nanoid(),
            imageUrl
        });
    }

    if (comicPages.length === 0) {
        throw new Error("The AI failed to generate any comic pages. Please try again.");
    }
    
    return comicPages;
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
