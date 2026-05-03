'use client';

import { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';

export default function UncensoredGPT() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'I am Dolphin, an uncensored AI. Ask me absolutely anything.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/uncensored-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${data.error || 'Something went wrong.'}` }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tool-page-container">
      <div className="tool-header">
        <h1>Uncensored GPT 🏴‍☠️</h1>
        <p>Powered by Dolphin 2.9 (Llama 3 70B). Zero filters, zero rules.</p>
      </div>

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '20px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '70vh',
        boxShadow: 'var(--shadow-lg)'
      }}>
        
        {/* Chat Area */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div 
                style={{
                  maxWidth: '85%',
                  padding: '16px 20px',
                  borderRadius: '20px',
                  backgroundColor: msg.role === 'user' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                  color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                  borderBottomRightRadius: msg.role === 'user' ? '4px' : '20px',
                  borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '20px',
                  lineHeight: '1.6'
                }}
                dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }}
              />
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '16px 20px',
                borderRadius: '20px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)'
              }}>
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} style={{
          padding: '20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <input
            type="text"
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '16px 24px',
              borderRadius: '30px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            style={{
              padding: '0 24px',
              borderRadius: '30px',
              border: 'none',
              backgroundColor: 'var(--accent)',
              color: 'white',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
              opacity: (!input.trim() || isLoading) ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
