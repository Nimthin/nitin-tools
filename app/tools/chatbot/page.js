'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import './chatbot.css';

export default function ChatbotPage() {
  const { userId, isLoaded, isSignedIn } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama-3.1-8b-instant');
  const [disabledModels, setDisabledModels] = useState({});

  const [selectedFile, setSelectedFile] = useState(null); // { file, previewUrl, base64 }
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Chat History State
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const isCreatingChatRef = useRef(false);
  const saveQueueRef = useRef(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history on mount if signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadChatHistory();
    }
  }, [isLoaded, isSignedIn]);

  const loadChatHistory = async () => {
    setIsFetchingHistory(true);
    try {
      const res = await fetch('/api/chat/history');
      const data = await res.json();
      if (data.chats) {
        setChatHistory(data.chats);
      }
    } catch (e) {
      console.error("Failed to load chat history", e);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setInput('');
    removeFile();
  };

  const loadSingleChat = async (id) => {
    try {
      const res = await fetch(`/api/chat/history?id=${id}`);
      const data = await res.json();
      if (data.chat) {
        setCurrentChatId(data.chat.id);
        setMessages(data.chat.messages || []);
        if (window.innerWidth <= 900) {
          setIsSidebarOpen(false); // Auto close sidebar on mobile
        }
      }
    } catch (e) {
      console.error("Failed to load chat", e);
    }
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat?')) return;
    
    try {
      await fetch(`/api/chat/history?id=${id}`, { method: 'DELETE' });
      setChatHistory(prev => prev.filter(c => c.id !== id));
      if (currentChatId === id) {
        startNewChat();
      }
    } catch (e) {
      console.error("Failed to delete chat", e);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile({
          file,
          previewUrl: URL.createObjectURL(file),
          base64: reader.result,
          mimeType: file.type,
          isPdf: file.type === 'application/pdf'
        });
      };
      reader.readAsDataURL(file);
    } else {
      alert("Only images and PDFs are supported currently.");
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = () => {
    if (selectedFile?.previewUrl) {
      URL.revokeObjectURL(selectedFile.previewUrl);
    }
    setSelectedFile(null);
  };

  const saveChatToDb = async (updatedMessages) => {
    if (!isSignedIn) return;

    try {
      if (currentChatId) {
        const res = await fetch('/api/chat/history', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: currentChatId, 
            messages: updatedMessages,
            title: updatedMessages[0]?.content.substring(0, 40) + "..."
          })
        });
        if (!res.ok) {
          const errorData = await res.json();
          console.error("Supabase Save Error (PUT):", errorData.error);
        }
        loadChatHistory();
      } else {
        if (isCreatingChatRef.current) {
          saveQueueRef.current = updatedMessages;
          return;
        }

        isCreatingChatRef.current = true;
        const res = await fetch('/api/chat/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: updatedMessages[0]?.content.substring(0, 40) + "...",
            messages: updatedMessages
          })
        });
        const data = await res.json();
        isCreatingChatRef.current = false;

        if (res.ok && data.chat) {
          const newId = data.chat.id;
          setCurrentChatId(newId);
          loadChatHistory();

          if (saveQueueRef.current) {
            const queuedMessages = saveQueueRef.current;
            saveQueueRef.current = null;
            await fetch('/api/chat/history', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                id: newId, 
                messages: queuedMessages,
                title: queuedMessages[0]?.content.substring(0, 40) + "..."
              })
            });
            loadChatHistory();
          }
        } else {
          console.error("Supabase Save Error (POST):", data.error || data.message);
        }
      }
    } catch (e) {
      console.error("Failed to sync chat to DB", e);
      isCreatingChatRef.current = false;
    }
  };

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed && !selectedFile) return;

    const userMessage = { 
      role: 'user', 
      content: trimmed,
      file: selectedFile ? {
        base64: selectedFile.base64,
        mimeType: selectedFile.mimeType,
        isPdf: selectedFile.isPdf
      } : null
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    removeFile();
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          selectedModel
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const finalMessages = [...newMessages, { role: 'assistant', content: data.message }];
        setMessages(finalMessages);
        saveChatToDb(finalMessages);
      } else {
        if (data.isQuotaError) {
          setDisabledModels(prev => ({ ...prev, [selectedModel]: true }));
          setMessages((prev) => [
            ...prev, 
            { 
              role: 'assistant', 
              content: `⚠️ The **${selectedModel.startsWith('gemini') ? 'Gemini' : 'Llama'}** model has reached its usage limit. Please select another model.` 
            }
          ]);
        } else {
          setMessages((prev) => [...prev, { role: 'assistant', content: data.error || 'Something went wrong. Please try again.' }]);
        }
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

  const modelsList = [
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Text + Image', vision: true },
    { id: 'llama-3.1-8b-instant', name: 'Text Only', vision: false },
  ];

  const currentModelConfig = modelsList.find(m => m.id === selectedModel) || modelsList[0];

  const handleModelChange = (e) => {
    const newModelId = e.target.value;
    const newModelConfig = modelsList.find(m => m.id === newModelId);
    
    if (newModelConfig && !newModelConfig.vision && selectedFile) {
      removeFile();
    }
    
    setSelectedModel(newModelId);
  };

  return (
    <div className="ai-chat-page">
      
      {/* Sidebar for Chat History */}
      <div className={`chat-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={startNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Chat
          </button>
          <button className="toggle-sidebar-btn" onClick={() => setIsSidebarOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
        </div>

        <div className="history-list">
          {!isSignedIn ? (
            <div className="sidebar-empty">
              <p style={{ marginBottom: '12px' }}>Sign in to save chats</p>
              <SignInButton mode="modal">
                <button className="sidebar-signin-btn">
                  Sign In
                </button>
              </SignInButton>
            </div>
          ) : isFetchingHistory && chatHistory.length === 0 ? (
            <div className="sidebar-empty">Loading...</div>
          ) : chatHistory.length === 0 ? (
            <div className="sidebar-empty">No past chats</div>
          ) : (
            chatHistory.map(chat => (
              <div 
                key={chat.id} 
                className={`history-item ${chat.id === currentChatId ? 'active' : ''}`}
                onClick={() => loadSingleChat(chat.id)}
              >
                <span className="history-title">{chat.title}</span>
                <button className="delete-chat-btn" onClick={(e) => deleteChat(e, chat.id)}>🗑️</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="ai-chat-main">
        <div className="main-header">
          <div className="main-header-left">
            {!isSidebarOpen && (
              <button className="toggle-sidebar-btn-inline" onClick={() => setIsSidebarOpen(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
              </button>
            )}
            <Link href="/" className="chatbot-back-btn">
              ← Back to Tools
            </Link>
          </div>
          <div className="main-header-title">🦕 DinoChat</div>
          <div className="main-header-right">
            {!isLoaded ? null : isSignedIn ? (
              <UserButton appearance={{ elements: { userButtonAvatarBox: { width: 30, height: 30, border: '2px solid var(--retro-border)', borderRadius: '4px' } } }} />
            ) : (
              <SignInButton mode="modal">
                <button className="header-signin-btn">
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </div>

        <div className={`ai-chat-body ${hasMessages ? 'has-messages' : ''}`}>
          {!hasMessages && (
            <div className="ai-chat-welcome">
              <div className="welcome-avatar">🤖</div>
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
                  <div className="ai-msg-content">
                    {msg.file && (
                      <div className="msg-attached-file">
                        {msg.file.isPdf ? (
                          <div className="attached-pdf-icon">📄 PDF Document</div>
                        ) : (
                          <img src={msg.file.base64} alt="Attached" className="attached-image" />
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <div className="ai-msg-bubble">
                        {msg.content}
                      </div>
                    )}
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

        {/* Input area */}
        <div className="ai-chat-input-area">
          
          {/* Inline Preview */}
          {selectedFile && (
            <div className="inline-preview-container">
              {selectedFile.isPdf ? (
                <div className="inline-preview-pdf-icon">📄</div>
              ) : (
                <img src={selectedFile.previewUrl} alt="Uploaded" className="inline-preview-image" />
              )}
              <div className="inline-preview-info">
                <span>{selectedFile.file.name}</span>
                <button className="remove-file-btn inline" onClick={removeFile}>✕</button>
              </div>
            </div>
          )}
          <div className="radiant-input-wrapper">
            <div className="radiant-input-border"></div>
            <div className="radiant-input-inner">
              
              {/* Add / Upload Button - Only show if vision is supported */}
              {currentModelConfig.vision && (
                <>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload}
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }} 
                  />
                  <button 
                    className="input-action-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload image"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                </>
              )}

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentModelConfig.vision ? "Ask anything or upload an image..." : "Ask anything..."}
                disabled={isLoading}
                className="radiant-input-field"
              />

              {/* Model Selection Dropdown inside input */}
              <div className="input-model-selector">
                <select 
                  value={selectedModel} 
                  onChange={handleModelChange}
                  disabled={isLoading}
                >
                  {modelsList.map(m => (
                    <option key={m.id} value={m.id} disabled={disabledModels[m.id]}>
                      {disabledModels[m.id] ? `${m.name} (Limit)` : m.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => sendMessage()}
                disabled={(!input.trim() && !selectedFile) || isLoading}
                className={`radiant-send-btn ${(input.trim() || selectedFile) ? 'active' : ''}`}
                aria-label="Send message"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"></line>
                  <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
