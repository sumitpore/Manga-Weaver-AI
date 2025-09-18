
import { GoogleGenAI, Modality, GenerateContentResponse, Type } from "@google/genai";
import type { ComicPage, StoryOutline, TextElement, TextElementData, ComicPanelPrompt, StoryPagePrompt } from '../types';
import { nanoid } from 'nanoid';
import { parsePx } from '../utils/canvas';
import { 
    createStoryOutlineSystemInstruction,
    createStoryOutlineUserPrompt,
    createVerifyImageSystemInstruction,
    createVerifyImageUserPrompt,
    createGenerateImageSystemInstruction,
    createRegenerateFailedImageSystemInstruction,
    createInitialImageVisualPrompt,
    createRetryImageVisualPrompt,
    createTextPlacementPrompt,
    createRegenerateAnnotatedPagePrompt
} from './prompts';

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

    const systemInstruction = createStoryOutlineSystemInstruction();
    const userPrompt = createStoryOutlineUserPrompt(prompt, numPages, characterPrompt);
    
    console.groupCollapsed('📝 [Prompt] Generating Story Outline');
    console.log('System Instruction:', systemInstruction);
    console.log('User Prompt:', userPrompt);
    
    try {
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
                                                            text: { type: Type.STRING },
                                                            character_identifier: { 
                                                                type: Type.STRING,
                                                                description: "A unique visual trait to identify the character for dialogue/thoughts. Not needed for narrative." 
                                                            }
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
        
        console.log('🤖 [AI Response] Raw JSON:', response.text);

        const jsonText = response.text.trim();
        const parsed = JSON.parse(jsonText);
        
        if (parsed.pages && Array.isArray(parsed.pages)) {
            // Validate text element constraints
            let totalTextElements = 0;
            let panelsWithTooManyElements = 0;
            
            parsed.pages.forEach((page: any, pageIndex: number) => {
                if (page.panels && Array.isArray(page.panels)) {
                    page.panels.forEach((panel: any, panelIndex: number) => {
                        if (panel.text_elements && Array.isArray(panel.text_elements)) {
                            const textCount = panel.text_elements.length;
                            totalTextElements += textCount;
                            
                            if (textCount > 2) {
                                panelsWithTooManyElements++;
                                console.warn(`⚠️ [Text Constraint] Page ${pageIndex + 1}, Panel ${panelIndex + 1} has ${textCount} text elements (recommended max: 2)`);
                                
                                // Optionally truncate to first 2 elements
                                panel.text_elements = panel.text_elements.slice(0, 2);
                                console.log(`🔧 [Auto-Fix] Truncated panel to 2 text elements`);
                            }
                        }
                    });
                }
            });
            
            console.log(`📊 [Text Analysis] Total text elements: ${totalTextElements}, Panels with 3+ elements: ${panelsWithTooManyElements}`);
            console.log('✅ [Success] Parsed and validated Story Outline:', parsed);
            return parsed as StoryOutline;
        }
        throw new Error("Invalid story outline format received from AI.");

    } catch (e) {
        console.error("🚫 [Error] Failed to parse story outline JSON:", e);
        throw new Error("The AI failed to generate a valid story outline. Please try a different prompt.");
    } finally {
        console.groupEnd();
    }
}

const verifyImageContent = async (imageUrl: string, panels: ComicPanelPrompt[], imageParts: any[]): Promise<{ isMatch: boolean; reasoning: string }> => {
    console.groupCollapsed(`🔎 [Verification] Verifying generated image content`);
    
    try {
        const mimeType = imageUrl.substring(imageUrl.indexOf(":") + 1, imageUrl.indexOf(";"));
        const data = imageUrl.split(',')[1];
        const generatedImagePart = { inlineData: { data, mimeType } };

        const panelDescriptions = panels.map(p => `Panel ${p.panel_number}: ${p.visual_description}`).join('\n');

        const systemInstruction = createVerifyImageSystemInstruction();

        const characterConsistencyPrompt = imageParts.length > 0
            ? `4.  **Character Consistency:** Do the characters depicted in the generated comic page visually match the provided reference character images? Pay close attention to hair, clothing, facial features and character specific traits.`
            : '';
        
        const characterReferenceInfo = imageParts.length > 0 
            ? 'and reference images' 
            : '';

        const userPrompt = createVerifyImageUserPrompt(panelDescriptions, panels.length, characterConsistencyPrompt, characterReferenceInfo);
        
        console.log('📝 [Input] Verification Prompt:', userPrompt);
        console.log(`🖼️ [Input] Image for Verification:`, imageUrl);
        console.log(
            '%c ',
            `padding: 200px; background: url(${imageUrl}) no-repeat center/contain;`
        );
        if (imageParts.length > 0) {
            console.log('🖼️ [Input] Character reference images for verification:', imageParts);
        }

        const allParts = [{ text: userPrompt }, generatedImagePart, ...imageParts];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: allParts },
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        is_match: { 
                            type: Type.BOOLEAN,
                            description: "True if the image is a very good match for the script, false otherwise."
                        },
                        reasoning: { 
                            type: Type.STRING,
                            description: "A detailed panel-wise explanation for your decision."
                        },
                    },
                    required: ["is_match", "reasoning"],
                },
            },
        });
        
        const jsonText = response.text.trim();
        console.log('🤖 [AI Response] Raw JSON:', jsonText);
        const parsed = JSON.parse(jsonText);

        const result = { isMatch: parsed.is_match, reasoning: parsed.reasoning };
        console.log(`✅ [Result] Verification Result: ${result.isMatch ? 'Match' : 'Mismatch'}. Reasoning: ${result.reasoning}`);
        return result;

    } catch (e) {
        console.error("🚫 [Error] Failed during image verification:", e);
        // If verification fails, assume it's not a match to be safe
        return { isMatch: false, reasoning: "An error occurred during the verification process." };
    } finally {
        console.groupEnd();
    }
};

const getPanelLayoutDescription = (panelCount: number): string => {
    switch (panelCount) {
        case 2:
            return 'either 1x2 or 2x1 grid';
        case 3:
            return 'either 1x3 grid or 3x1 grid';
        case 4:
            return 'a 2x2 grid';
        default:
            // This case should ideally not be hit due to story generation constraints (2-4 panels)
            return `${panelCount} panels`;
    }
};

const generatePageContent = async (panels: ComicPanelPrompt[], imageParts: any[]): Promise<{ imageUrl: string }> => {
    const MAX_ATTEMPTS = 2; // 1 initial try + 2 retries
    let lastImageUrl = '';
    let lastReasoning = ''; // To store failure reason for retries

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        console.log(`--- 🎨 Image Generation Attempt ${attempt} of ${MAX_ATTEMPTS} ---`);
        const model = 'gemini-2.5-flash-image-preview';

        const panelDescriptions = panels.map(p => `Panel ${p.panel_number}: ${p.visual_description}`).join('\n\n');
        
        let visualPrompt: string;
        const promptParts: any[] = [];

        if (attempt === 1 || !lastImageUrl) {
            // First attempt or if a previous attempt failed to produce an image
            const layoutDescription = getPanelLayoutDescription(panels.length);
            visualPrompt = createInitialImageVisualPrompt(layoutDescription, panelDescriptions);
            promptParts.push({ text: visualPrompt });
            promptParts.push(...imageParts); // Character references
        } else {
            // Subsequent attempts: use the last failed image and reasoning
            visualPrompt = createRetryImageVisualPrompt(attempt, lastReasoning, panelDescriptions);

            const mimeType = lastImageUrl.substring(lastImageUrl.indexOf(":") + 1, lastImageUrl.indexOf(";"));
            const data = lastImageUrl.split(',')[1];
            const lastImagePart = { inlineData: { data, mimeType } };

            promptParts.push({ text: visualPrompt });
            promptParts.push(lastImagePart); // The failed image
            promptParts.push(...imageParts); // Character references
        }

        // Use specialized regeneration system instruction for retry attempts
        const currentSystemInstruction = attempt === 1 ? createGenerateImageSystemInstruction() : createRegenerateFailedImageSystemInstruction();

        console.groupCollapsed(`🎨 [Prompt] Generating Page Content (Image) - Attempt ${attempt}`);
        console.log(`System Instruction (${attempt === 1 ? 'Initial' : 'Regeneration'}):`, currentSystemInstruction);
        console.log('Visual Prompt:', visualPrompt);
        if (imageParts.length > 0) {
            console.log('🖼️ [Input] Character reference images:', imageParts);
        }
        if (attempt > 1 && lastImageUrl) {
            console.log(`🖼️ [Input] Previous failed image for correction:`, lastImageUrl);
        }

        const contents = {
            parts: promptParts,
        };
        
        let generatedImageUrl: string | null = null;
        try {
             const response: GenerateContentResponse = await ai.models.generateContent({
                model,
                contents,
                config: {
                    systemInstruction: currentSystemInstruction,
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });
            
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64ImageBytes: string = part.inlineData.data;
                    generatedImageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
                    console.log(`🖼️ [Output] Generated Image URL (Nano Banana):`, generatedImageUrl);
                    console.log(
                        '%c ',
                        `padding: 200px; background: url(${generatedImageUrl}) no-repeat center/contain;`
                    );
                    break; // Found an image, break the loop
                }
            }
        } finally {
            console.groupEnd();
        }

        if (generatedImageUrl) {
            lastImageUrl = generatedImageUrl; // Save the last generated image
            const { isMatch, reasoning } = await verifyImageContent(generatedImageUrl, panels, imageParts);
            if (isMatch) {
                console.log(`✅ [Success] Image passed verification on attempt ${attempt}.`);
                return { imageUrl: generatedImageUrl };
            } else {
                lastReasoning = reasoning; // Store the reasoning for the next attempt
                console.warn(`⚠️ [Verification Failed] Attempt ${attempt} did not match the prompt. Reasoning: ${reasoning}`);
                if (attempt < MAX_ATTEMPTS) {
                    console.log('Retrying with feedback...');
                }
            }
        } else {
             console.error(`🚫 [Error] AI did not return an image on attempt ${attempt}.`);
             lastImageUrl = ''; // Reset lastImageUrl so next attempt starts fresh if no image was produced
             lastReasoning = 'The AI model failed to produce an image in the previous step.';
        }
    }

    if (lastImageUrl) {
        console.warn(`⚠️ [Final Attempt] Failed to generate a verified image after ${MAX_ATTEMPTS} attempts. Using the last generated image as a fallback.`);
        return { imageUrl: lastImageUrl };
    }

    throw new Error(`AI did not return an image for page after ${MAX_ATTEMPTS} attempts.`);
}

const getTextElementPositions = async (imageUrl: string, panels: ComicPanelPrompt[]): Promise<TextElement[]> => {
    const allTextElements = panels.flatMap(p => p.text_elements);
    if (allTextElements.length === 0) return [];

    console.groupCollapsed(`📍 [Prompt] Getting Text Element Positions for Page`);
    
    // FIX: Declare response outside the try-catch block to make it accessible in the catch block.
    let response: GenerateContentResponse | undefined;
    try {
        const mimeType = imageUrl.substring(imageUrl.indexOf(":") + 1, imageUrl.indexOf(";"));
        const data = imageUrl.split(',')[1];
        const imagePart = { inlineData: { data, mimeType } };

        const textList = panels.map(panel => 
            `Panel ${panel.panel_number} Text:\n` +
            panel.text_elements.map((el, i) => {
                const identifier = el.character_identifier ? `, FOR CHARACTER: "${el.character_identifier}"` : '';
                return `${i + 1}. TYPE: ${el.type}, TEXT: "${el.text}"${identifier}`;
            }).join('\n')
        ).join('\n\n');


        const prompt = createTextPlacementPrompt(textList);

        console.log('📝 [Input] Text Element Prompt:', prompt);
        console.log(`🖼️ [Input] Image for Analysis:`, imageUrl);
        console.log(
            '%c ',
            `padding: 200px; background: url(${imageUrl}) no-repeat center/contain;`
        );

        const textPart = { text: prompt };

        response = await ai.models.generateContent({
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

        // Helper function to check if two 250x100px text rectangles overlap
        const checkTextElementOverlap = (x1: number, y1: number, x2: number, y2: number): boolean => {
            // Two rectangles overlap if: |x1-x2| < 280px AND |y1-y2| < 130px (with 30px gap)
            return Math.abs(x1 - x2) < 280 && Math.abs(y1 - y2) < 130;
        };

        // Track positioned elements to prevent overlaps
        const positionedElements: { x: number; y: number; panel: number }[] = [];

        const aiElements: TextElement[] = parsedArray
            .map((item: any): TextElement | null => {
                if (
                    typeof item.x_position === 'string' &&
                    typeof item.y_position === 'string' &&
                    typeof item.element_type === 'string' &&
                    typeof item.text === 'string'
                ) {
                    // Use AI-provided coordinates as-is without automatic adjustments
                    const x = parsePx(item.x_position);
                    const y = parsePx(item.y_position);
                    
                    // Log coordinate information for debugging (but don't modify coordinates)
                    console.log(`📍 [AI Coordinates] Using exact AI placement for "${item.text.substring(0, 30)}...": (${x}, ${y})`);
                    
                    // Optional: Log warnings for potentially problematic coordinates but don't change them
                    if (x < 0 || x + 250 > 1024 || y < 0 || y + 100 > 1024) {
                        console.warn(`⚠️ [Coordinate Warning] AI coordinates for "${item.text.substring(0, 30)}...": (${x}, ${y}) may extend beyond 1024x1024 canvas bounds`);
                    }

                    // Optional: Log panel boundary information but don't adjust coordinates
                    if (item.panel_number && panelMap.has(item.panel_number)) {
                        const panel = panelMap.get(item.panel_number);
                        const finalX = parsePx(item.x_position);
                        const finalY = parsePx(item.y_position);
                        
                        if (finalX < panel.minX || finalX > panel.maxX || finalY < panel.minY || finalY > panel.maxY) {
                            console.warn(`⚠️ [Panel Warning] Text "${item.text.substring(0, 30)}..." at (${finalX}, ${finalY}) appears outside Panel ${item.panel_number} boundaries: (${panel.minX}-${panel.maxX}, ${panel.minY}-${panel.maxY})`);
                        } else {
                            console.log(`✅ [Panel Info] Text for Panel ${item.panel_number} positioned within boundaries`);
                        }
                    }

                    // Track positioned elements for informational purposes (but don't adjust for overlaps)
                    const currentX = parsePx(item.x_position);
                    const currentY = parsePx(item.y_position);
                    const currentPanel = item.panel_number || 1;
                    
                    const overlappingElements = positionedElements.filter(pos => 
                        pos.panel === currentPanel && checkTextElementOverlap(currentX, currentY, pos.x, pos.y)
                    );
                    
                    if (overlappingElements.length > 0) {
                        console.warn(`⚠️ [Overlap Info] Text "${item.text.substring(0, 30)}..." at (${currentX}, ${currentY}) may overlap with ${overlappingElements.length} other text element(s) in Panel ${currentPanel}`);
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
                    
                    // Add to positioned elements for overlap tracking
                    positionedElements.push({
                        x: parsePx(item.x_position),
                        y: parsePx(item.y_position),
                        panel: item.panel_number || 1
                    });
                    
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
        // FIX: Check if `response` is defined before accessing `response.text` using optional chaining.
        console.error("🚫 [Critical Error] Failed to parse text element positions JSON:", e, response?.text);
        console.error("🔍 [Debug] This usually indicates the AI returned malformed JSON or an unexpected response structure");
        
        // Try to extract any useful information from the raw response for debugging
        try {
            // FIX: Check if `response` is defined before trying to access its properties.
            if (response) {
                const partialJson = response.text.trim();
                console.log("🧪 [Debug] Raw response length:", partialJson.length);
                console.log("🧪 [Debug] First 500 chars:", partialJson.substring(0, 500));
                console.log("🧪 [Debug] Last 200 chars:", partialJson.substring(Math.max(0, partialJson.length - 200)));
            }
        } catch (debugError) {
            console.error("🚫 [Debug Error] Could not even extract debug info:", debugError);
        }
        
        // Return empty so the comic can still be shown without text
        console.log("⚠️ [Fallback] Returning empty text elements array to allow comic display without text");
        return [];
    } finally {
        console.groupEnd();
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
    
    const basePrompt = createRegenerateAnnotatedPagePrompt();
    
    let fullPrompt = basePrompt;
    if (annotationText) {
        fullPrompt += `\n\nAdditionally, apply these text-based instructions, which correspond to the numbered points on the image:\n${annotationText}`;
    }

    console.groupCollapsed('✨ [Prompt] Regenerating Page (Image)');
    console.log('📝 [Input] Regeneration Prompt:', fullPrompt);
    console.log(`🖼️ [Input] Annotated Image (Nano Banana):`, annotatedImageB64);
    console.log(
        '%c ',
        `padding: 200px; background: url(${annotatedImageB64}) no-repeat center/contain;`
    );

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

    try {
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
                console.log(`🖼️ [Output] Regenerated Image URL:`, imageUrl);
                console.log(
                    '%c ',
                    `padding: 200px; background: url(${imageUrl}) no-repeat center/contain;`
                );
                return { imageUrl };
            }
        }

        throw new Error("AI could not regenerate the image. Please try again.");
    } finally {
        console.groupEnd();
    }
};
