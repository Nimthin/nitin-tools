import { NextResponse } from 'next/server';
import { websiteInfo } from '@/lib/websiteInfo';

export async function POST(request) {
  try {
    const { messages, selectedModel = 'llama' } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const systemPromptText = `You are a highly capable, friendly AI assistant integrated into "Nitin's Toolkit". 

You are free to answer ANY question the user asks, whether it is about programming, general knowledge, math, science, or casual conversation. You do not need to restrict yourself. Be as helpful as possible.

Below is the COMPLETE, real-time knowledge base of everything this website does, its philosophy, and the tools it offers. Use this information if the user asks any questions about the website, what it can do, or how it works:

--- WEBSITE KNOWLEDGE BASE ---
${websiteInfo}
------------------------------`;

    if (selectedModel.startsWith('gemini')) {
      // ---------------------------------
      // GEMINI API
      // ---------------------------------
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return NextResponse.json({ error: 'Gemini API key is missing' }, { status: 500 });
      }

      // Map messages to Gemini format (roles: 'user', 'model')
      const geminiContents = messages.map(msg => {
        const parts = [{ text: msg.content || "Analyze the attached image." }];
        
        if (msg.file) {
          const rawBase64 = msg.file.base64.split(',')[1];
          parts.push({
            inlineData: {
              mimeType: msg.file.mimeType,
              data: rawBase64
            }
          });
        }

        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts
        };
      });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPromptText }] },
          contents: geminiContents,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1024,
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Gemini API Error Response:", JSON.stringify(data, null, 2));
        if (response.status === 429) {
          return NextResponse.json({ error: 'Quota exceeded for Gemini', isQuotaError: true }, { status: 429 });
        }
        throw new Error(data.error?.message || 'Failed to fetch from Gemini API');
      }

      const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return NextResponse.json({ message: textOutput });

    } else {
      // ---------------------------------
      // GROQ (LLAMA, MIXTRAL, GEMMA) API
      // ---------------------------------
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) {
        return NextResponse.json({ error: 'Groq API key is missing' }, { status: 500 });
      }

      const systemPrompt = { role: 'system', content: systemPromptText };
      
      // Ensure Groq doesn't try to process PDFs since its vision models only support images
      const hasPdf = messages.some(msg => msg.file && msg.file.mimeType === 'application/pdf');
      if (hasPdf) {
        return NextResponse.json({ error: 'PDF uploads are only supported on Google Gemini models. Please switch to Gemini 2.5 from the dropdown.' }, { status: 400 });
      }

      const groqMessages = messages.map(msg => {
        if (msg.file) {
          return {
            role: msg.role,
            content: [
              { type: 'text', text: msg.content || "Analyze the attached image." },
              { type: 'image_url', image_url: { url: msg.file.base64 } }
            ]
          };
        }
        return { role: msg.role, content: msg.content };
      });

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [systemPrompt, ...groqMessages],
          temperature: 0.5,
          max_tokens: 1024,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          return NextResponse.json({ error: 'Quota exceeded for Llama (Groq)', isQuotaError: true }, { status: 429 });
        }
        throw new Error(data.error?.message || 'Failed to fetch from Groq API');
      }

      return NextResponse.json({ message: data.choices[0].message.content });
    }

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 });
  }
}
