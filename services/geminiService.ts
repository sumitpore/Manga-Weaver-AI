
import { GoogleGenAI, Modality, GenerateContentResponse, Type } from "@google/genai";
import type { ComicPage, StoryOutline, TextElement, TextElementData, ComicPanelPrompt, StoryPagePrompt } from '../types';
import { nanoid } from 'nanoid';
import { parsePx } from '../utils/canvas';

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

    const systemInstruction = `You are a master storyteller and manga scriptwriter. Your task is to break down a user's story idea into a page-by-page script for a manga. Each page must be divided into 2 to 4 distinct PANELS (or micro-scenes).

For each panel, you must provide:
1.  A 'visual_description': A vivid description focusing only on character actions, expressions, setting, and camera angles for that specific panel. This part should NOT contain any dialogue or text.
2.  A list of 'text_elements': This should contain all dialogue, character thoughts, or narrative text boxes for that panel.

CRITICAL RULE: Within a single panel, only ONE character may speak or have thoughts. This is to ensure a clear, readable flow. Do not assign dialogue from multiple characters to the same panel.

STYLE CONSISTENCY: Specify that ALL pages should use the same visual style - either full color manga style OR black and white manga style, but be consistent throughout the entire comic.`;

    const userPrompt = `
        Story Idea: "${prompt}"
        Number of Pages: ${numPages}
        ${characterPrompt}

        Generate a JSON object that contains a list of page-by-page scripts, with each page broken down into panels.
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
                                panels: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            panel_number: { type: Type.INTEGER },
                                            visual_description: { type: Type.STRING },
                                            text_elements: {
                                                type: Type.ARRAY,
                                                items: {
                                                    type: Type.OBJECT,
                                                    properties: {
                                                        type: { type: Type.STRING },
                                                        text: { type: Type.STRING }
                                                    },
                                                    required: ["type", "text"]
                                                }
                                            }
                                        },
                                        required: ["panel_number", "visual_description", "text_elements"]
                                    }
                                }
                            },
                             required: ["page_number", "panels"]
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

const generatePageContent = async (panels: ComicPanelPrompt[], imageParts: any[]): Promise<{ imageUrl: string }> => {
     const model = 'gemini-2.5-flash-image-preview';

    const systemInstruction = `You are an expert manga artist AI. Your task is to generate a single composite manga page containing multiple panels based on the provided script.
- The output image MUST BE a 1024x1024 square.
- Arrange the panels in a standard comic book layout (e.g., a 2x2 grid or vertical stack).
- Draw clear, black gutter lines between each panel to visually separate them.
- It should be in a consistent FULL COLOR modern manga style.
- CRITICAL: The image must NOT contain any text, speech bubbles, narrative boxes, or any form of typography. The final output must be pure artwork only. Ignore any text in the user prompt and only focus on the visual descriptions.`;

    const panelDescriptions = panels.map(p => `Panel ${p.panel_number}: ${p.visual_description}`).join('\n\n');
    const visualPrompt = `Create a comic page with ${panels.length} panels.\n${panelDescriptions}`;

    const contents = {
        parts: [
            { text: visualPrompt },
            ...imageParts
        ],
    };
    
     const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents,
        config: {
            systemInstruction,
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

    throw new Error(`AI did not return an image for page.`);
}

const getTextElementPositions = async (imageUrl: string, panels: ComicPanelPrompt[]): Promise<TextElement[]> => {
    const allTextElements = panels.flatMap(p => p.text_elements);
    if (allTextElements.length === 0) return [];

    const mimeType = imageUrl.substring(imageUrl.indexOf(":") + 1, imageUrl.indexOf(";"));
    const data = imageUrl.split(',')[1];
    const imagePart = { inlineData: { data, mimeType } };

    const textList = panels.map(panel => 
        `Panel ${panel.panel_number} Text:\n` +
        panel.text_elements.map((el, i) => `${i + 1}. TYPE: ${el.type}, TEXT: "${el.text}"`).join('\n')
    ).join('\n\n');


    const prompt = `You are analyzing a composite comic page image (1024x1024px) containing multiple panels, and placing text elements for each panel. Your task is to determine optimal coordinates for each text element.

CRITICAL ANALYSIS STEPS:

1. **IMAGE ANALYSIS:**
   - The image is EXACTLY 1024px × 1024px
   - Identify the panel layout (typically 2x2 grid, 3-panel vertical, or similar)
   - Note the black gutter/border lines separating panels
   - For each panel, identify:
     * Panel boundaries (top, left, bottom, right coordinates)
     * Characters present and their positions
     * Empty/background areas suitable for text placement
     * Key visual elements to avoid (faces, hands, important objects)

2. **PANEL-SPECIFIC POSITIONING STRATEGY:**
   - **Panel 1** (typically top-left): Usually coordinates ~(40,40) to (~500,500)
   - **Panel 2** (typically top-right): Usually coordinates ~(524,40) to (~984,500)  
   - **Panel 3** (typically bottom-left): Usually coordinates ~(40,524) to (~500,984)
   - **Panel 4** (typically bottom-right): Usually coordinates ~(524,524) to (~984,984)
   
   ADAPT these ranges based on the actual panel layout you observe.

3. **TEXT PLACEMENT RULES BY TYPE:**

   **DIALOGUE (speech bubbles):**
   - Place in empty background areas within the character's panel
   - Position 60-120px away from speaker's head/mouth area
   - anchor_position should point to speaker's head/shoulder region
   - Prefer positions above, beside, or slightly below the character
   - Avoid placing over any character features

   **THOUGHTS (thought bubbles):**
   - Similar to dialogue but typically placed higher (above character's head)
   - More floating placement, can be in upper areas of the panel
   - anchor_position should point toward character's head/temple area

   **NARRATIVE (captions):**
   - Place at panel edges: top-left, top-right, bottom-left, or bottom-right of the panel
   - Leave 20-30px margin from panel borders
   - Usually rectangular text boxes, no anchor needed

4. **COORDINATE CALCULATION:**
   - Use the panel boundary coordinates identified in step 1
   - Ensure minimum 30px gap between text elements in the same panel
   - Leave 25px minimum margin from panel edges
   - Coordinates should be realistic for text box placement (not single points)

5. **QUALITY ASSURANCE:**
   - Verify each text element is completely within its assigned panel
   - Confirm no overlap with character faces, hands, or important visual elements
   - Ensure anchors point to logical character body parts

RESPONSE FORMAT:
Return JSON with 'perceived_dimensions' and 'placements' array. Include panel analysis in your reasoning.

Text elements to place:
${textList}`;

    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, imagePart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    perceived_dimensions: {
                        type: Type.OBJECT,
                        properties: {
                            width: { type: Type.INTEGER },
                            height: { type: Type.INTEGER },
                        },
                        description: "The AI's perceived dimensions of the image."
                    },
                    panel_analysis: {
                        type: Type.OBJECT,
                        properties: {
                            layout_type: { type: Type.STRING, description: "e.g., '2x2_grid', '3_vertical', '2_horizontal'" },
                            panel_count: { type: Type.INTEGER },
                            panel_boundaries: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        panel_number: { type: Type.INTEGER },
                                        top_left: { type: Type.OBJECT, properties: { x: { type: Type.INTEGER }, y: { type: Type.INTEGER } } },
                                        bottom_right: { type: Type.OBJECT, properties: { x: { type: Type.INTEGER }, y: { type: Type.INTEGER } } }
                                    },
                                    required: ["panel_number", "top_left", "bottom_right"]
                                }
                            }
                        },
                        required: ["layout_type", "panel_count", "panel_boundaries"],
                        description: "Analysis of the panel layout and boundaries"
                    },
                    placements: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                x_position: { type: Type.STRING, description: "Left position with 'px' suffix, e.g., '150px'" },
                                y_position: { type: Type.STRING, description: "Top position with 'px' suffix, e.g., '200px'" },
                                element_type: { type: Type.STRING, enum: ["dialogue", "narrative", "thoughts"] },
                                text: { type: Type.STRING },
                                panel_number: { type: Type.INTEGER, description: "Which panel this text belongs to" },
                                placement_reasoning: { type: Type.STRING, description: "Brief explanation of why this position was chosen" },
                                anchor_position: {
                                    type: Type.OBJECT,
                                    properties: {
                                        x: { type: Type.STRING, description: "Anchor X with 'px' suffix" },
                                        y: { type: Type.STRING, description: "Anchor Y with 'px' suffix" },
                                    },
                                    nullable: true,
                                    description: "For dialogue/thoughts bubbles, specifies the point the tail should aim at."
                                }
                            },
                            required: ["x_position", "y_position", "element_type", "text", "panel_number", "placement_reasoning"]
                        },
                    }
                },
                 required: ["perceived_dimensions", "panel_analysis", "placements"]
            },
        },
    });

    try {
        const jsonText = response.text.trim();
        console.log('🤖 [AI Response] Raw JSON from AI:', jsonText);
        
        const parsed: any = JSON.parse(jsonText);

        console.log('🤖 [AI Dimensions] AI perceived image as:', parsed.perceived_dimensions);
        console.log('🎭 [AI Panel Analysis] Panel layout analysis:', parsed.panel_analysis);

        const parsedArray: any[] = parsed.placements;
        console.log('📍 [AI Positioning] Parsed positioning data from 1024x1024 space:', parsedArray);
        
        // Log placement reasoning for debugging
        parsedArray.forEach((item, index) => {
            if (item.placement_reasoning) {
                console.log(`🧠 [AI Reasoning ${index + 1}] ${item.element_type} for Panel ${item.panel_number}: ${item.placement_reasoning}`);
            }
        });

        // Extract panel boundaries for validation if provided
        const panelBoundaries = parsed.panel_analysis?.panel_boundaries || [];
        const panelMap = new Map();
        panelBoundaries.forEach((panel: any) => {
            panelMap.set(panel.panel_number, {
                minX: panel.top_left.x,
                minY: panel.top_left.y,
                maxX: panel.bottom_right.x,
                maxY: panel.bottom_right.y
            });
        });

        const aiElements: TextElement[] = parsedArray
            .map((item: any): TextElement | null => {
                if (
                    typeof item.x_position === 'string' &&
                    typeof item.y_position === 'string' &&
                    typeof item.element_type === 'string' &&
                    typeof item.text === 'string'
                ) {
                    // Validate coordinates are reasonable (within 1024x1024 bounds with margins)
                    const x = parsePx(item.x_position);
                    const y = parsePx(item.y_position);
                    
                    if (x < 0 || x > 1024 || y < 0 || y > 1024) {
                        console.warn(`🚫 [Coordinate Error] Invalid coordinates for "${item.text.substring(0, 30)}...": (${x}, ${y}) - outside 1024x1024 bounds`);
                        // Clamp to valid range
                        const clampedX = Math.max(40, Math.min(x, 924)); // Leave room for text width
                        const clampedY = Math.max(40, Math.min(y, 924)); // Leave room for text height
                        item.x_position = `${clampedX}px`;
                        item.y_position = `${clampedY}px`;
                        console.log(`🔧 [Auto-Fix] Clamped coordinates to (${clampedX}, ${clampedY})`);
                    }

                    // Validate panel boundary constraints if panel information is available
                    if (item.panel_number && panelMap.has(item.panel_number)) {
                        const panel = panelMap.get(item.panel_number);
                        const finalX = parsePx(item.x_position);
                        const finalY = parsePx(item.y_position);
                        
                        if (finalX < panel.minX || finalX > panel.maxX || finalY < panel.minY || finalY > panel.maxY) {
                            console.warn(`⚠️ [Panel Boundary] Text "${item.text.substring(0, 30)}..." at (${finalX}, ${finalY}) appears outside Panel ${item.panel_number} boundaries: (${panel.minX}-${panel.maxX}, ${panel.minY}-${panel.maxY})`);
                            
                            // Try to fix by constraining to panel with margin
                            const margin = 25;
                            const constrainedX = Math.max(panel.minX + margin, Math.min(finalX, panel.maxX - margin - 200)); // 200px for text width
                            const constrainedY = Math.max(panel.minY + margin, Math.min(finalY, panel.maxY - margin - 60)); // 60px for text height
                            
                            if (constrainedX !== finalX || constrainedY !== finalY) {
                                item.x_position = `${constrainedX}px`;
                                item.y_position = `${constrainedY}px`;
                                console.log(`🔧 [Panel Fix] Moved text to panel-constrained position: (${constrainedX}, ${constrainedY})`);
                            }
                        } else {
                            console.log(`✅ [Panel Valid] Text for Panel ${item.panel_number} correctly positioned within boundaries`);
                        }
                    }

                    // Map AI element types to our expected types
                    let mappedType: TextElement['type'];
                    switch (item.element_type.toLowerCase()) {
                        case 'character_dialogue':
                        case 'dialogue':
                            mappedType = 'dialogue';
                            break;
                        case 'character_thought':
                        case 'thought':
                        case 'thoughts':
                            mappedType = 'thoughts';
                            break;
                        case 'narrative_text':
                        case 'narrative':
                            mappedType = 'narrative';
                            break;
                        default:
                            console.warn('🚫 [Type Error] Unknown element_type from AI:', item.element_type, 'Item:', item);
                            return null;
                    }

                    // Enhanced anchor validation for dialogue and thoughts
                    let anchor = undefined;
                    if ((mappedType === 'dialogue' || mappedType === 'thoughts') && item.anchor_position && 
                        typeof item.anchor_position.x === 'string' && typeof item.anchor_position.y === 'string') {
                        
                        const anchorX = parsePx(item.anchor_position.x);
                        const anchorY = parsePx(item.anchor_position.y);
                        
                        if (anchorX >= 0 && anchorX <= 1024 && anchorY >= 0 && anchorY <= 1024) {
                            anchor = { x: item.anchor_position.x, y: item.anchor_position.y };
                            console.log(`🎯 [Anchor] ${mappedType} anchor at (${anchorX}, ${anchorY}) for "${item.text.substring(0, 20)}..."`);
                        } else {
                            console.warn(`🚫 [Anchor Error] Invalid anchor coordinates for "${item.text.substring(0, 30)}...": (${anchorX}, ${anchorY})`);
                        }
                    } else if ((mappedType === 'dialogue' || mappedType === 'thoughts') && !item.anchor_position) {
                        console.warn(`⚠️ [Missing Anchor] ${mappedType} element missing anchor_position: "${item.text.substring(0, 30)}..."`);
                    }

                    const element = {
                        id: nanoid(),
                        x: item.x_position,
                        y: item.y_position,
                        type: mappedType,
                        text: item.text,
                        anchor,
                    };

                    console.log(`✅ [Element Created] ${mappedType} at (${item.x_position}, ${item.y_position})${anchor ? ` with anchor (${anchor.x}, ${anchor.y})` : ''}: "${item.text.substring(0, 30)}..."`);
                    return element;
                }
                console.warn('🚫 [Validation Error] Received invalid or incomplete text element data from AI:', item);
                return null;
            })
            .filter((el): el is TextElement => el !== null);
        
        console.log(`✅ [Success] Parsed ${aiElements.length} elements from AI.`);
        console.log(`🏁 [Final Result] Returning ${aiElements.length} elements with direct 1024x1024 coordinates.`);
        aiElements.forEach((element, index) => {
            console.log(`🏁 [Final] ${index + 1}. ${element.type}: "${element.text.substring(0, 25)}..." at (${element.x}, ${element.y})`);
        });
        
        return aiElements;

    } catch (e) {
        console.error("🚫 [Critical Error] Failed to parse text element positions JSON:", e, response.text);
        console.error("🔍 [Debug] This usually indicates the AI returned malformed JSON or an unexpected response structure");
        
        // Try to extract any useful information from the raw response for debugging
        try {
            const partialJson = response.text.trim();
            console.log("🧪 [Debug] Raw response length:", partialJson.length);
            console.log("🧪 [Debug] First 500 chars:", partialJson.substring(0, 500));
            console.log("🧪 [Debug] Last 200 chars:", partialJson.substring(Math.max(0, partialJson.length - 200)));
        } catch (debugError) {
            console.error("🚫 [Debug Error] Could not even extract debug info:", debugError);
        }
        
        // Return empty so the comic can still be shown without text
        console.log("⚠️ [Fallback] Returning empty text elements array to allow comic display without text");
        return [];
    }
};

export const generateComicStory = async (prompt: string, files: File[], numPages: number): Promise<ComicPage[]> => {
    const storyOutline = await generateStoryOutline(prompt, numPages, files.length > 0);
    const imageParts = await Promise.all(files.map(fileToGenerativePart));
    
    const comicPages: ComicPage[] = [];

    for(const pagePrompt of storyOutline.pages) {
        const { imageUrl } = await generatePageContent(pagePrompt.panels, imageParts);
        const textElements = await getTextElementPositions(imageUrl, pagePrompt.panels);
        
        comicPages.push({
            id: nanoid(),
            imageUrl,
            storyPrompt: pagePrompt,
            textElements,
        });
    }

    if (comicPages.length === 0) {
        throw new Error("The AI failed to generate any comic pages. Please try again.");
    }
    
    return comicPages;
};

export const regeneratePage = async (annotatedImageB64: string, annotationText: string): Promise<{ imageUrl: string }> => {
    const model = 'gemini-2.5-flash-image-preview';
    const mimeType = annotatedImageB64.substring(annotatedImageB64.indexOf(":") + 1, annotatedImageB64.indexOf(";"));
    const data = annotatedImageB64.split(',')[1];
    
    const basePrompt = `Incorporate the changes described by the annotations (drawings, arrows, shapes, etc.) on this image. Maintain the consistent FULL COLOR manga/anime style. The output image MUST BE a 1024x1024 square.

IMPORTANT: The output should be the image ONLY. Do not add any text, dialogue, or narrative boxes. The final image should be clean of any text. Maintain the same color style as the rest of the comic. The image may contain multiple panels; preserve the panel layout and gutter lines.

Crucially, remove the annotation drawings, text, and shapes from the final image output, leaving only the modified comic art.`;
    
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