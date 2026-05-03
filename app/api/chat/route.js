import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: 'API key is missing' }, { status: 500 });
    }

    const systemPrompt = {
      role: 'system',
      content: `You are the friendly, helpful AI assistant for "Nitin's Toolkit", a privacy-focused personal website that processes everything directly in the browser. 
      
Your ONLY job is to answer questions about the tools available on this website. Keep responses short, enthusiastic, and highly concise (1-2 sentences). Do not use markdown for simple answers unless necessary.

Available Tools on the website:
1. Image Toolkit: Includes a "Background Remover" (removes image backgrounds using AI) and "Image to Text" (extracts text from images using OCR).
2. PDF Toolkit: Includes "Image to PDF" (combines images into a PDF), "Page Remover" (deletes pages from a PDF), and "PDF Merger" (combines multiple PDFs).
3. YouTube to MP3: Downloads audio directly from YouTube videos.
4. Universal File Converter: Converts files between all possible formats (e.g., PDF to Excel, Excel to PDF, Word to PDF, Images, etc.).

If a user asks about any of these, confirm we have the tool and tell them they can find it on the site. If they ask about something we don't offer (like a video editor, or general trivia), politely apologize and say you are only equipped to help with Nitin's Toolkit features.`
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [systemPrompt, ...messages],
        temperature: 0.5,
        max_tokens: 150,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to fetch from Groq API');
    }

    return NextResponse.json({
      message: data.choices[0].message.content
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
