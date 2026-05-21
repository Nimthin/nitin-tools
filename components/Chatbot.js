'use client';

import { useState, useRef, useEffect } from 'react';
import './Chatbot.css';

// Custom-coded Retro SVG Dinosaur
const CustomDinoIcon = () => {
  const pixels = [
    "0000001111110",
    "0000012222221",
    "0000012222221",
    "0000123122221",
    "0000122222221",
    "0000122222221",
    "0000122211110",
    "0000122210000",
    "0011222221100",
    "0121222222210",
    "0122222221100",
    "0012222221000",
    "0001222210000"
  ];
  const frame1 = ["0000121210000", "0000110110000"];
  const frame2 = ["0000011210000", "0000000110000"];
  
  const colors = { '1': '#000000', '2': 'var(--pixel-green, #4caf50)', '3': '#ffffff' };
  
  const renderGrid = (grid, yOffset = 0) => (
    grid.map((row, y) => (
      row.split('').map((char, x) => (
        char !== '0' ? <rect key={`${x}-${y + yOffset}`} x={x} y={y + yOffset} width="1" height="1" fill={colors[char]} /> : null
      ))
    ))
  );

  return (
    <div style={{ position: 'relative', width: '48px', height: '48px', filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.5))' }}>
      <style>{`
        .dino-f1 { animation: dToggle 0.6s steps(1) infinite; }
        .dino-f2 { opacity: 0; animation: dToggleAlt 0.6s steps(1) infinite; }
        @keyframes dToggle { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes dToggleAlt { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
      `}</style>
      <svg viewBox="0 0 13 15" width="48" height="48" className="dino-f1" style={{ position: 'absolute', top: 0, left: 0 }}>
        {renderGrid(pixels)}
        {renderGrid(frame1, 13)}
      </svg>
      <svg viewBox="0 0 13 15" width="48" height="48" className="dino-f2" style={{ position: 'absolute', top: 0, left: 0 }}>
        {renderGrid(pixels)}
        {renderGrid(frame2, 13)}
      </svg>
    </div>
  );
};

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hey! 🦕 I'm Dino, your retro system assistant. Type 'help' or ask me about any tool on this site!" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Show helpful hint balloon shortly after loading if closed
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTip(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    setShowTip(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userVal = input.trim();
    const userMessage = { role: 'user', content: userVal };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          isHomepage: true
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'SYSTEM ERROR: Response failed. Try again.' }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'CONNECTION ERROR: System offline.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chatbot-wrapper">

      {/* Chat Window */}
      <div className={`chatbot-window ${isOpen ? 'open' : ''}`}>
        {/* Title Bar */}
        <div className="chatbot-header">
          <div className="chatbot-header-title">
            <span style={{ fontSize: '1.2rem' }}>🦕</span>
            DINO ASSISTANT
          </div>
          <button className="chatbot-close" onClick={toggleChat} title="Close">✕</button>
        </div>

        {/* Messages */}
        <div className="chatbot-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`chatbot-message ${msg.role}`}>
              <div className="message-bubble">
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="chatbot-message assistant">
              <div className="message-bubble loading">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form className="chatbot-input-area" onSubmit={sendMessage}>
          <input
            type="text"
            placeholder="Ask about a tool..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
          />
          <button type="submit" disabled={!input.trim() || isLoading} aria-label="Send">
            Send
          </button>
        </form>
      </div>

      {/* Floating Action Button */}
      <button 
        className={`chatbot-fab ${isOpen ? 'hidden' : ''}`} 
        onClick={toggleChat}
        aria-label="Open Chat"
      >
        <CustomDinoIcon />
      </button>
    </div>
  );
}
