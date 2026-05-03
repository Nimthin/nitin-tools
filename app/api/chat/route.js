import { NextResponse } from 'next/server';
import { websiteInfo } from '@/lib/websiteInfo';

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
      content: `You are a highly capable, friendly AI assistant integrated into "Nitin's Toolkit". 

You are free to answer ANY question the user asks, whether it is about programming, general knowledge, math, science, or casual conversation. You do not need to restrict yourself. Be as helpful as possible.

Below is the COMPLETE, real-time knowledge base of everything this website does, its philosophy, and the tools it offers. Use this information if the user asks any questions about the website, what it can do, or how it works:

--- WEBSITE KNOWLEDGE BASE ---
${websiteInfo}
------------------------------`
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
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
