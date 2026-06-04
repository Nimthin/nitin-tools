import { NextResponse } from 'next/server';
import { websiteInfo } from '@/lib/websiteInfo';

export async function POST(request) {
  try {
    let { 
      messages, 
      selectedModel = 'llama-3.1-8b-instant', 
      isHomepage = false, 
      isNotesApp = false, 
      noteContext = null 
    } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // Force Llama model for the homepage assistant
    if (isHomepage) {
      selectedModel = 'llama-3.1-8b-instant';
    }

    let systemPromptText;
    if (isHomepage) {
      systemPromptText = `You are the official website assistant for "Nitin's Toolkit". 

Your ONLY purpose is to answer questions related to this website, its philosophy, its tools, its features, and how to use it.
CRITICAL CONSTRAINT 1: You must refuse to answer any questions that are NOT about this website, its tools, or its contents. If the user asks general questions (such as general programming help, math, writing, history, translations, recipes, or general knowledge), you must politely decline and state that you are only programmed to help guide them on using the tools on this website.
CRITICAL CONSTRAINT 2: Keep your answers extremely short, concise, and direct (maximum 2-3 sentences). Do not write long paragraphs or verbose explanations.

Below is the COMPLETE, real-time knowledge base of everything this website does, its philosophy, and the tools it offers. Use this information to answer user questions:

--- WEBSITE KNOWLEDGE BASE ---
${websiteInfo}
------------------------------`;
    } else if (isNotesApp) {
      systemPromptText = `You are a highly capable, friendly, and helpful AI writing and note-taking assistant integrated directly into the user's note-taking application.

Your primary role is to assist the user with drafting, outlining, summarizing, correcting grammar, rewriting, and brainstorming ideas for their notes.

CRITICAL INSTRUCTIONS:
1. Do NOT output programming code, code snippets, or coding help unless the user explicitly requests it (e.g., "write a javascript function") or the note itself is explicitly code. Instead, write in clear, natural prose or outline structures.
2. The user is currently editing a note with the following details:
   - Title: ${noteContext?.title || '(Untitled Note)'}
   - Content:
   --- START OF NOTE ---
   ${noteContext?.content || '(Empty Note)'}
   --- END OF NOTE ---
3. When the user mentions "my note", "this note", "summarize", "improve this", or asks questions about their writing, use the note content provided above as your primary context.
4. Keep your answers concise, direct, and conversational. Use markdown formatting like bolding, bullet points, and headers to make notes clean and readable. Do NOT output markdown code blocks (\`\`\`) unless specifically asked for code or technical syntax.
5. Avoid filler phrases at the start of responses (e.g. "Sure! Here is a summary:"). Jump straight to the useful response.
6. Do NOT attempt to generate, display, or suggest images, drawings, or photos under any circumstances. If the user asks for an image or drawing, politely refuse and state that you are only designed to assist with text and writing.`;
    } else {
      systemPromptText = `You are a highly capable, friendly, and concise AI assistant called DinoChat.

RESPONSE GUIDELINES:
- Be concise and direct. Avoid filler phrases and unnecessary repetition.
- Use **markdown formatting** to structure your responses: bold for emphasis, bullet points for lists, headings for sections, and fenced code blocks with language tags for code.
- For simple questions, give a short direct answer (1-3 sentences).
- For complex topics, use structured formatting with headers and bullet points, but keep each section brief.
- Use analogies sparingly and only when they genuinely clarify.
- When showing code, always use fenced code blocks with the language specified.
- Do NOT start responses with "Great question!" or similar filler. Jump straight to the answer.

IMAGE GENERATION:
- When the user asks for a picture, photo, image, drawing, generation, or illustration of something (e.g., "draw a hydrogen atom", "show me a photo of a hydrogen molecule", "generate an image of a cat"), you MUST generate the image dynamically.
- To generate/display an image, ALWAYS output a markdown image tag using the Pollinations AI URL format (WITHOUT ANY CURLY BRACES in the URL):
  \`![description](https://image.pollinations.ai/prompt/URL_ENCODED_PROMPT?width=768&height=768&nologo=true)\`
- Replace \`URL_ENCODED_PROMPT\` with a highly descriptive, visually detailed prompt in URL-encoded format (e.g. spaces become %20, commas %2C, etc.).
- CRITICAL: Do NOT include literal curly braces \`{\` or \`}\` in your output image URL.
- Example: If the user asks for "a picture of a hydrogen chemical structure", you could render:
  \`![Hydrogen Chemical Structure](https://image.pollinations.ai/prompt/scientific%20diagram%20of%20a%20hydrogen%20atom%20showing%20nucleus%20and%20electron%20cloud%2C%20highly%20detailed%20educational%20graphics?width=768&height=768&nologo=true)\`
- Do not mention the website "Pollinations" directly to the user; just present the markdown image tag seamlessly.`;
    }

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
