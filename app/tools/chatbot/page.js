'use client';

import { useState, useRef, useEffect } from 'react';
import './chatbot.css';

const suggestions = [
  { icon: '✨', title: 'Creative Writing', desc: 'Stories, poems, scripts' },
  { icon: '💻', title: 'Code Analysis', desc: 'Debug, refactor, optimize' },
  { icon: '🧠', title: 'Problem Solving', desc: 'Math, logic, reasoning' },
  { icon: '📚', title: 'Research', desc: 'Summaries, explanations' },
];

export default function ChatbotPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isLoading) return;

    const userMessage = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error. Please check your connection.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="ai-chat-page">
      {/* Chat messages area */}
      <div className={`ai-chat-body ${hasMessages ? 'has-messages' : ''}`}>
        {!hasMessages && (
          <div className="ai-chat-welcome">
            <h1 className="ai-chat-title">How can I help?</h1>
            <p className="ai-chat-subtitle">
              Ask me anything — code, writing, math, ideas, or just chat.
            </p>
          </div>
        )}

        {hasMessages && (
          <div className="ai-chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-msg ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="ai-msg-avatar">🤖</div>
                )}
                <div className="ai-msg-bubble">
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="ai-msg assistant">
                <div className="ai-msg-avatar">🤖</div>
                <div className="ai-msg-bubble ai-loading">
                  <span className="ai-dot"></span>
                  <span className="ai-dot"></span>
                  <span className="ai-dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area — always at bottom */}
      <div className="ai-chat-input-area">
        <div className="radiant-input-wrapper">
          <div className="radiant-input-border"></div>
          <div className="radiant-input-inner">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              disabled={isLoading}
              className="radiant-input-field"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className={`radiant-send-btn ${input.trim() ? 'active' : ''}`}
              aria-label="Send message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </button>
          </div>
        </div>

        {/* Suggestion chips — only when no messages */}
        {!hasMessages && (
          <div className="ai-chat-suggestions">
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="ai-suggestion-chip"
                onClick={() => sendMessage(`Help me with ${s.title.toLowerCase()}: ${s.desc}`)}
              >
                <span className="ai-suggestion-icon">{s.icon}</span>
                <div>
                  <span className="ai-suggestion-title">{s.title}</span>
                  <span className="ai-suggestion-desc">{s.desc}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
