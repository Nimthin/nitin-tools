'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import './Header.css';

export default function Header() {

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    // Collect "behind the scenes" user info
    const userInfo = {
      userAgent: window.navigator.userAgent,
      language: window.navigator.language,
      platform: window.navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      localTime: new Date().toString(),
    };

    try {
      const formData = new FormData();
      formData.append("access_key", "a82f9612-3707-4a4b-b4dd-0f635fdacf41");
      formData.append("subject", `[Toolkit Feedback] New Suggestion/Bug Report from ${email}`);
      formData.append("from_name", "Nitin Tools Feedback");
      formData.append("email", email);
      formData.append("message", `New Feedback Received!\n\nFrom: ${email}\nSuggestion/Bug: \n${suggestion}\n\n--- Behind The Scenes User Info ---\nLocal Time: ${userInfo.localTime}\nTimezone: ${userInfo.timezone}\nBrowser/OS: ${userInfo.userAgent}\nPlatform: ${userInfo.platform}\nLanguage: ${userInfo.language}\nScreen Res: ${userInfo.screenResolution}\nWindow Size: ${userInfo.windowSize}`);

      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to send feedback');
      }

      setSubmitStatus('success');
      setTimeout(() => {
        setIsFeedbackOpen(false);
        setSubmitStatus(null);
        setEmail('');
        setSuggestion('');
      }, 2000);
    } catch (error) {
      console.error(error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="apple-header">
        <div className="apple-header-content">
          <Link href="/" className="apple-logo" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '1.2rem', imageRendering: 'pixelated' }}>🦕</span>
            DinoTools
          </Link>
          <nav className="apple-nav">
            <Link href="/" className="apple-nav-link">Home</Link>
            <Link href="/tools/pdf" className="apple-nav-link" target="_blank" rel="noopener noreferrer">PDFs</Link>
            <Link href="/tools/image" className="apple-nav-link" target="_blank" rel="noopener noreferrer">Images</Link>
            <Link href="/tools/youtube-audio" className="apple-nav-link" target="_blank" rel="noopener noreferrer">Audio</Link>
            <Link href="/tools/file-converter" className="apple-nav-link" target="_blank" rel="noopener noreferrer">Convert</Link>
            <button className="apple-nav-link feedback-btn" onClick={() => setIsFeedbackOpen(true)}>
              Feedback
            </button>

            {/* Clerk Authentication UI */}
            <div className="auth-wrapper" style={{ display: 'flex', alignItems: 'center', marginLeft: '12px' }}>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="apple-nav-link auth-btn" style={{ fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton appearance={{ elements: { userButtonAvatarBox: { width: 32, height: 32 } } }} />
              </SignedIn>
            </div>

          </nav>
        </div>
      </header>

      {/* Feedback Modal */}
      {isFeedbackOpen && (
        <div className="feedback-modal-overlay" onClick={() => setIsFeedbackOpen(false)}>
          <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-modal-header">
              <h2>Send Feedback</h2>
              <button className="close-btn" onClick={() => setIsFeedbackOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleFeedbackSubmit} className="feedback-form">
              <p className="feedback-desc">
                Tell us what bugs you found, or what new tools you'd like to see added to the toolkit!
              </p>

              <div className="form-group">
                <label htmlFor="email">Email Address <span className="required">*</span></label>
                <input 
                  type="email" 
                  id="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required 
                />
                <span className="email-hint">This email id will be used to contact you regarding your feedback.</span>
              </div>

              <div className="form-group">
                <label htmlFor="suggestion">Your Suggestion / Bug Report <span className="required">*</span></label>
                <textarea 
                  id="suggestion" 
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder="What's on your mind?"
                  rows="4"
                  required 
                />
              </div>

              {submitStatus === 'success' && (
                <div className="status-message success">
                  ✅ Feedback sent successfully! Thank you.
                </div>
              )}
              {submitStatus === 'error' && (
                <div className="status-message error">
                  ❌ Failed to send feedback. Please try again.
                </div>
              )}

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={() => setIsFeedbackOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting || !email || !suggestion}
                >
                  {isSubmitting ? 'Sending...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
