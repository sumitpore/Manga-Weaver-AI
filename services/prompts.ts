
export const createStoryOutlineSystemInstruction = (): string => `You are a master storyteller and manga scriptwriter. Your task is to break down a user's story idea into a page-by-page script for a manga. Each page must be divided into 2 to 4 distinct PANELS (or micro-scenes).

**CRITICAL CANVAS AND TEXT CONSTRAINTS:**
- Final comic pages are EXACTLY 1024px x 1024px
- Each text element (dialogue, thoughts, narrative) occupies 250px x 100px of space
- With the supported panel layouts (2x2 grid 1x2 grid, 2x1 grid, and 1x3 grid) each panel has limited space for text elements
- MAXIMUM text elements per panel: 2
- Consider that characters, backgrounds, and visual elements also need space
- Text elements must not overlap with each other or important visual elements

For each panel, you must provide:
1.  A 'visual_description': A vivid description focusing only on character actions, expressions, setting, and camera angles for that specific panel. This part should NEVER contain any dialogue or text.
2.  A list of 'text_elements': This should contain all dialogue, character thoughts, or narrative text boxes for that panel. For 'dialogue' and 'thoughts', you MUST also provide a 'character_identifier'. This should be a concise visual description of the character speaking or thinking (e.g., 'the tall knight in silver armor', 'the small cat with a red collar'), NOT just their name. This is crucial for the artist AI to correctly attribute the text. Narrative text does not need a character identifier.

**TEXT ELEMENT CONSTRAINTS:**
- MAXIMUM 1-2 text elements per panel
- Each text element should be concise to fit within 250x100px space
- Prioritize the most important dialogue/thoughts for each panel
- Consider text placement when describing visual scenes (leave space for text)

CRITICAL RULE: Within a single panel, only ONE character may speak or have thoughts. This is to ensure a clear, readable flow. Do not assign dialogue from multiple characters to the same panel.

STYLE CONSISTENCY: Specify that ALL pages should use the same visual style - either full color manga style OR black and white manga style, but be consistent throughout the entire comic.`;

export const createStoryOutlineUserPrompt = (prompt: string, numPages: number, characterPrompt: string): string => `
    Story Idea: "${prompt}"
    Number of Pages: ${numPages}
    ${characterPrompt}

    Generate a JSON object that contains a list of page-by-page scripts, with each page broken down into panels.
    
    **REMEMBER THE CONSTRAINTS:**
    - Each panel should have AT MOST 1-2 text elements (dialogue, thoughts, or narrative)
    - Keep text concise to fit in 250x100px boxes
    - Leave visual space in panels for text placement
    - Focus on the most essential dialogue/thoughts per panel
`;

export const createVerifyImageSystemInstruction = (): string => `You are an AI assistant specialized in visual verification. Your task is to analyze a comic page image and determine if it accurately depicts the provided panel-by-panel script and any character references. Provide a direct, boolean answer and a brief justification. Be strict in your assessment. The image must not contain any text, dialogue, or speech bubbles.`;

export const createVerifyImageUserPrompt = (panelDescriptions: string, panelsLength: number, characterConsistencyPrompt: string, characterReferenceInfo: string): string => `
    Please verify if the provided generated comic page image accurately matches the following script ${characterReferenceInfo}.

    **Script:**
    ${panelDescriptions}

    **Verification Criteria:**
    1.  **Content Match:** Do the characters, actions, and settings in each panel of the image match the script's visual descriptions?
    2.  **Panel Count:** Does the image have the correct number of panels (${panelsLength})?
    3.  **No Text:** Is the image completely free of any text, speech bubbles, or narrative boxes?
    ${characterConsistencyPrompt}

    Based on these criteria, does the image satisfy the requirements?
`;


export const createGenerateImageSystemInstruction = (): string => `You are an expert manga artist AI. Your task is to generate a single composite manga page containing multiple panels based on the provided script.
- The output image MUST BE a 1024x1024 square.
- Arrange the panels in one of the following layouts: 2x2 grid 1x2 grid, 2x1 grid, 1x3 grid
- Draw clear, black gutter lines between each panel to visually separate them.
- Each panel can have maximum one image only. Do not create sub-panels within one panel.
- The color scheme should be consistent throughout all pages
- CRITICAL: The image must NOT contain any text, speech bubbles, narrative boxes, or any form of typography. The final output must be pure artwork only. Ignore any text in the user prompt and only focus on the visual descriptions.`;

export const createRegenerateFailedImageSystemInstruction = (): string => `You are an expert manga artist AI specialized in CORRECTING failed comic page generations. Your primary task is to analyze a previously generated image that failed verification and create a corrected version.

**CORRECTION METHODOLOGY:**
- Study the failed image and the verification failure reason
- Identify specific elements that need modification while preserving successful aspects
- Focus on the issues that caused verification failure
- Only PERFORM the correction in the image, DO NOT generate anything entirely new

**OUTPUT REQUIREMENTS:**
- Generate a corrected 1024x1024px comic page that addresses all issues that caused verification failure
- Valid panel layouts: 2x2 grid 1x2 grid, 2x1 grid, 1x3 grid
- Each panel can have maximum one image only. Do not create sub-panels within one panel.

Your success is measured by passing the automated verification system.`;


export const createInitialImageVisualPrompt = (layoutDescription: string, panelDescriptions: string): string =>
    `Create a comic page with ${layoutDescription}.\n${panelDescriptions}`;

export const createRetryImageVisualPrompt = (attempt: number, lastReasoning: string, panelDescriptions: string): string =>
    `This is attempt #${attempt}. The previous image generation was not accurate.
Reasoning for failure: "${lastReasoning}"

Please correct the provided image based on this feedback and the original script. Ensure the new image strictly follows all instructions.

**Original Script:**
${panelDescriptions}`;


export const createTextPlacementPrompt = (textList: string): string => `You are analyzing a composite comic page image (1024x1024px) containing multiple panels, and placing text elements for each panel. Your task is to determine optimal coordinates for each text element.

**CRITICAL TEXT ELEMENT DIMENSIONS:**
- Each text element occupies EXACTLY 250px width x 100px height
- The x,y coordinates you provide represent the TOP-LEFT corner of this 250x100px rectangle
- **IMPORTANT:** Your coordinates will be used EXACTLY as specified - no automatic adjustments will be made
- You must ensure the ENTIRE 250x100px area fits within panel boundaries
- Text elements must NOT overlap with each other (maintain minimum 30px gap between any two text rectangles)

CRITICAL ANALYSIS STEPS:

1. **IMAGE ANALYSIS:**
   - The image is EXACTLY 1024px x 1024px
   - Identify the panel layout (typically 2x2 grid, 3-panel vertical, or similar)
   - Note the black gutter/border lines separating panels
   - For each panel, identify:
     * Panel boundaries (top, left, bottom, right coordinates)
     * Characters present and their positions. **Use the 'FOR CHARACTER' identifier from the text list to find the correct character for dialogue/thoughts.**
     * Empty/background areas suitable for text placement (remember: need 250x100px clear space)
     * Key visual elements to avoid (faces, hands, important objects)

2. **TEXT PLACEMENT RULES BY TYPE:**

   **DIALOGUE (speech bubbles):**
   - **CRITICAL:** Use the 'character_identifier' to locate the speaker in the panel. The bubble and its anchor MUST correspond to this character.
   - Place in empty background areas within the character's panel
   - Position 60-120px away from speaker's head/mouth area
   - anchor_position should point to speaker's head/shoulder region
   - Prefer positions above, beside, or slightly below the character
   - Avoid placing over any character features
   - **CRITICAL:** Ensure 250x100px rectangle doesn't overlap with characters or panel edges

   **THOUGHTS (thought bubbles):**
   - **CRITICAL:** Use the 'character_identifier' to locate the thinking character. The bubble and its anchor MUST correspond to this character.
   - Similar to dialogue but typically placed higher (above character's head)
   - More floating placement, can be in upper areas of the panel
   - anchor_position should point toward character's head/temple area
   - **CRITICAL:** Ensure 250x100px rectangle fits in upper panel areas

   **NARRATIVE (captions):**
   - Place at panel edges: top-left, top-right, bottom-left, or bottom-right of the panel
   - Leave 25px minimum margin from panel borders
   - Usually rectangular text boxes, no anchor needed
   - **CRITICAL:** Ensure entire 250x100px box stays within panel (max x = panel_right - 275px, max y = panel_bottom - 125px)

3. **COORDINATE CALCULATION WITH SIZE CONSTRAINTS:**
   - Use the panel boundary coordinates identified in step 1
   - For each text position (x,y), verify that (x + 250, y + 100) stays within panel bounds
   - Ensure minimum 30px gap between any two text rectangles (check all 4 corners)
   - Leave 25px minimum margin from panel edges
   - **FORMULA:** Valid x range = panel_left + 25 to panel_right - 275, Valid y range = panel_top + 25 to panel_bottom - 125

4. **OVERLAP PREVENTION:**
   - Before placing each text element, check against all previously placed elements in the same panel
   - Two 250x100px rectangles overlap if: |x1-x2| < 280px AND |y1-y2| < 130px
   - If overlap detected, find alternative position with 30px minimum gap

5. **QUALITY ASSURANCE:**
   - Verify each 250x100px text rectangle is completely within its assigned panel
   - Confirm no overlap with character faces, hands, or important visual elements
   - Ensure no overlap between any two text elements
   - Ensure anchors point to logical character body parts

RESPONSE FORMAT:
Return JSON with 'perceived_dimensions' and 'placements' array. Include panel analysis in your reasoning.

Text elements to place:
${textList}`;


export const createRegenerateAnnotatedPagePrompt = (): string => `Incorporate the changes described by the annotations (drawings, arrows, shapes, etc.) on this image. Maintain the consistent FULL COLOR manga/anime style. The output image MUST BE a 1024x1024 square.

IMPORTANT: The output should be the image ONLY. Do not add any text, dialogue, or narrative boxes. The final image should be clean of any text. Maintain the same color style as the rest of the comic. The image may contain multiple panels; preserve the panel layout and gutter lines.

Crucially, remove the annotation drawings, text, and shapes from the final image output, leaving only the modified comic art.`;
