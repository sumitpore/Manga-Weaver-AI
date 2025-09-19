# Manga Weaver AI

An AI-powered application to create and refine single or multi-page manga/anime comics. Provide a story, upload reference characters, and use intuitive annotations to guide the AI in perfecting every panel.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy AI Studio app

This contains everything you need to run app locally.

View the app in AI Studio: https://ai.studio/apps/drive/1_3iQbPLTNy8T_Yb-MuxKGuBxFyGEiOs-

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## ✨ Features

- **AI Story & Image Generation**: Leverages the Gemini API to generate multi-page comic book scripts and panel art from a simple text prompt.
- **Character Consistency**: Supports uploading reference images for characters to maintain visual consistency across panels and pages.
- **Parallel Page Processing**: Generates multiple comic pages concurrently to significantly reduce waiting times.
- **Dynamic Progress Tracking**: A detailed, branching progress bar keeps the user informed about the AI's generation process, from storyboarding to final rendering.
- **In-Browser Editing Suite**:
    - **Text Manipulation**: Edit, move, and delete AI-placed dialogue, narration, and thought bubbles.
    - **Annotation Tools**: Use arrows, shapes, and text notes to mark up images for targeted revisions.
- **Iterative Regeneration**: Regenerate specific pages with your annotations and instructions to fine-tune the artwork.
- **PDF Export**: Download your final multi-page comic as a high-quality PDF document.

## 🚀 Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **AI Model**: Google Gemini (`gemini-2.5-flash` for text/logic, `gemini-2.5-flash-image-preview` for image generation/editing)
- **Core Libraries**:
    - `@google/genai`: The official SDK for the Gemini API.
    - `jspdf` & `html2canvas`: For generating PDF files from the comic pages.
    - `nanoid`: For generating unique IDs for pages and text elements.

## 📂 Project Structure

The project is organized into a modular structure to separate concerns:

```
/
├── public/
├── src/
│   ├── components/       # UI components (HomePage, ComicDisplay, etc.)
│   ├── hooks/            # Custom React hooks (useAnnotations)
│   ├── services/         # API interaction logic (geminiService, prompts)
│   ├── utils/            # Utility functions (canvas helpers)
│   ├── App.tsx           # Main application component
│   ├── index.tsx         # React entry point
│   └── types.ts          # TypeScript type definitions
├── index.html            # Main HTML file
└── metadata.json         # Application metadata
```

## 🧠 How It Works

The comic creation process is a sophisticated pipeline orchestrated by the `geminiService.ts` module, which leverages multiple calls to the Gemini API.

1.  **Story Outline Generation**:
    - The user's prompt, number of pages, and character information are sent to `gemini-2.5-flash`.
    - A detailed system prompt instructs the model to act as a manga scriptwriter, breaking the story into pages and panels (2-3 per page).
    - The AI returns a structured `JSON` object (`StoryOutline`) containing visual descriptions and text elements for each panel, adhering to strict constraints like a maximum of two text elements per panel.

2.  **Parallel Page Generation**:
    - To speed up the process, pages are generated in concurrent batches (with a `CONCURRENCY_LIMIT` of 2).
    - For each page, the following steps occur:
        1.  **Image Generation**: The visual descriptions for the page's panels are sent to `gemini-2.5-flash-image-preview`. This model creates a single 1024x1024 image containing the panel layout. This step is attempted up to two times.
        2.  **Image Verification**: The generated image is sent back to `gemini-2.5-flash` along with the original script. The AI verifies if the image accurately depicts the content, has the correct number of panels, and contains no text. If verification fails, a second generation attempt is made using the failure reason as feedback.
        3.  **Text Placement**: Once a satisfactory image is generated, it is sent to `gemini-2.5-flash` again. The model analyzes the image to find empty spaces and returns precise `(x, y)` coordinates for placing each dialogue, narration, and thought bubble, including anchor points for speech tails.

3.  **Editing and Refinement**:
    - The generated pages are displayed in the `ComicDisplay` component.
    - The `useAnnotations` hook manages the state for the HTML5 Canvas, allowing the user to draw shapes and add text notes on top of the comic page.
    - Text elements are rendered as draggable and editable HTML elements, allowing for direct manipulation.

4.  **Regeneration**:
    - When a user requests regeneration, the application captures the comic image along with the user-drawn annotations into a single base64 string.
    - This annotated image and any text notes are sent to `gemini-2.5-flash-image-preview` with a prompt instructing it to incorporate the requested changes, resulting in a revised image.
