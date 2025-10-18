import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import advisorsData from '@/data/advisors.json';

export async function POST(request: NextRequest) {
  try {
    const { advisorId, messages } = await request.json();

    // Validate input
    if (!advisorId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request. Need advisorId and messages array.' },
        { status: 400 }
      );
    }

    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      // Return mock response if no API key
      return NextResponse.json({
        reply: "I'm a mock advisor response. Set GEMINI_API_KEY in your .env.local file to enable real AI responses. For now, I can help you with basic financial questions!"
      });
    }

    // Find the advisor
    const advisor = advisorsData.find(a => a.id === advisorId);
    if (!advisor) {
      return NextResponse.json(
        { error: 'Advisor not found' },
        { status: 404 }
      );
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Build conversation history with system prompt
    const conversationHistory = [
      {
        role: 'user',
        parts: [{ text: advisor.systemPrompt }]
      },
      {
        role: 'model',
        parts: [{ text: 'Understood. I am ready to assist as ' + advisor.name + '.' }]
      }
    ];

    // Add user messages
    messages.forEach((msg: { role: string; content: string }) => {
      conversationHistory.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    });

    // Start chat and get response
    const chat = model.startChat({
      history: conversationHistory.slice(0, -1), // All except last message
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const response = result.response;
    const text = response.text();

    return NextResponse.json({ reply: text });

  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get response from AI',
        reply: "I'm having trouble connecting right now. Please try again."
      },
      { status: 500 }
    );
  }
}
