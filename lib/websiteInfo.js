export const websiteInfo = `
# Nitin's Toolkit: Comprehensive Website Information

## Core Philosophy
Nitin's Toolkit is a personal utility website designed around extreme privacy, speed, and modern aesthetics (Apple-style minimalism). 
The absolute most important feature of this website is **Client-Side Processing**. 
Unlike other online tools that upload your files to a cloud server to process them (which is slow and a privacy risk), Nitin's Toolkit downloads the actual logic (WebAssembly, AI models, libraries) directly into the user's browser. 
All files (images, PDFs, documents) never leave the user's computer. They are processed locally inside the browser.

## Currently Available Tools

### 1. Image Toolkit (Path: /tools/image)
  - **Background Remover (/tools/image/background-remover):** Uses a local AI model (from imgly) loaded via CDN to automatically detect and erase the background from any uploaded image (JPG, PNG, WebP). Features a brush tool to manually fix up edges.
  - **Image to Text OCR (/tools/image/image-to-text):** Uses Tesseract.js to scan images and extract written text (Optical Character Recognition). Great for copying text out of screenshots or scanned documents.
  - **Compress & Resize (/tools/image/optimize):** Visual image optimizer that compresses and resizes images (PNG, JPEG, WebP) fully client-side using HTML5 Canvas. Allows adjusting dimensions, scale, format, and quality.

### 2. PDF Toolkit (Path: /tools/pdf)
  - **Image to PDF (/tools/pdf/image-to-pdf):** Allows users to drag and drop multiple images, reorder them, and compile them into a single PDF document.
  - **Page Remover (/tools/pdf/page-remover):** Users upload a PDF, visually see all the pages, click the ones they want to delete, and instantly download the cleaned PDF.
  - **PDF Merger (/tools/pdf/pdf-merger):** Combines multiple separate PDF files into one continuous document.

### 3. YouTube Audio Downloader (Path: /tools/youtube-audio)
  - Users paste a YouTube link, and it securely fetches the video and extracts the highest quality MP3 audio (up to 320 kbps). Powered by a Cobalt API backend.

### 4. Video & Animation Toolkit (Path: /tools/Video)
  - **Video to GIF (/tools/Video/video-to-gif):** Trims local video files (MP4, WebM) using start/end range inputs and converts them to high-quality animated GIFs client-side via a WebAssembly FFmpeg instance, featuring custom FPS, scale, and range parameters.

### 5. QR Code Generator (Path: /tools/qr-generator)
  - Generates custom QR codes client-side for URLs, WiFi configurations, contact vCards, SMS text, or emails. Features customizable background/foreground colors, sizes, error correction levels, and supports SVG/PNG downloads.

### 6. Universal File Converter (Path: /tools/file-converter)
  - An extremely powerful "Anything to Anything" file converter.
  - **Capabilities:** Can convert documents (Word/DOCX to PDF), spreadsheets (Excel/XLSX to PDF), images (HEIC to JPG, PNG to WebP), and media files (powered by an in-browser WebAssembly FFmpeg engine). 
  - Completely private, done in-browser.

## Technical Details
- **Tech Stack:** Next.js 14, React 18, pure Vanilla CSS with CSS Variables.
- **Deployment:** Vercel.
- **Feedback System:** Passwordless Web3Forms integration.
- **Chatbot:** Powered by Groq's API using Llama 3 models or Google's Gemini API key for advanced queries.
`;
