/**
 * ChatWidget.jsx — Redesigned AI Chat Widget
 * Glassmorphism dark theme, gradient bubbles, glowing toggle, framer-motion animations
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const SESSION_KEY = 'chatbot_session_id';

const QUICK_REPLIES = [
  'How do I track my order?',
  'How to create an account?',
  'Payment methods',
  'Contact support',
];

const SUGGESTED = [
  'What is SupplyChain Guardian?',
  'How do I place an order?',
  'Pricing plans',
  'Reset my password',
];

function fmtTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

function LoadingDots() {
  return (
    <div className="flex gap-1.5 items-center h-7">
      <motion.span
        className="w-2 h-2 rounded-full"
        style={{ background: '#8b5cf6' }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
      />
      <motion.span
        className="w-2 h-2 rounded-full"
        style={{ background: '#8b5cf6' }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
      />
      <motion.span
        className="w-2 h-2 rounded-full"
        style={{ background: '#8b5cf6' }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
      />
    </div>
  );
}

const messageVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export default function ChatWidget() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || null);
  const [handoff, setHandoff]   = useState(false);
  const [rated, setRated]       = useState(false);
  const [streamText, setStreamText] = useState('');
  const [selectedRating, setSelectedRating] = useState(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Load session history on mount
  useEffect(() => {
    if (sessionId) {
      fetch(`${API}/api/chat/session/${sessionId}`)
        .then(r => r.json())
        .then(d => { if (d.messages?.length) setMessages(d.messages); })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setHandoff(false);

    const userMsg = { role: 'user', content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreamText('');

    try {
      const res = await fetch(`${API}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId }),
      });

      const newSid = res.headers.get('X-Session-Id');
      if (newSid && newSid !== sessionId) {
        setSessionId(newSid);
        localStorage.setItem(SESSION_KEY, newSid);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errData = await res.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: errData.error || 'Sorry, the AI service is currently unavailable. Please try again later.',
          timestamp: new Date(),
        }]);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Server error (${res.status}). Please try again.`,
          timestamp: new Date(),
        }]);
        setLoading(false);
        return;
      }

      if (!res.body || typeof res.body.getReader !== 'function') {
        const text = await res.text();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: text || 'No response from server.',
          timestamp: new Date(),
        }]);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.replace(/^data:\s*/, '');
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.chunk) {
              accumulated += parsed.chunk;
              setStreamText(accumulated);
            }
            if (parsed.done) {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: accumulated,
                timestamp: new Date(),
                confidence: parsed.confidence,
              }]);
              setStreamText('');
              if (parsed.handoff) setHandoff(true);
            }
            if (parsed.error) {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
              }]);
              setStreamText('');
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('[ChatWidget] fetch error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Please check your internet and try again.',
        timestamp: new Date(),
      }]);
      setStreamText('');
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId]);

  const handleRate = async (score) => {
    if (!sessionId || rated) return;
    setSelectedRating(score);
    await fetch(`${API}/api/chat/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, rating: score }),
    }).catch(() => {});
    setRated(true);
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(SESSION_KEY);
    setHandoff(false);
    setRated(false);
    setSelectedRating(null);
  };

  const emojis = ['😞', '😐', '🙂', '😊', '😄'];

  return (
    <>
      {/* ── Floating Toggle Button (Glowing Purple) ── */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center text-white"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: open
            ? '0 0 0 0 rgba(99,102,241,0)'
            : '0 8px 24px rgba(99,102,241,0.4), 0 0 0 0 rgba(99,102,241,0.3)',
          border: 'none',
          cursor: 'pointer',
          outline: 'none',
        }}
        animate={!open ? {
          boxShadow: [
            '0 8px 24px rgba(99,102,241,0.4), 0 0 0 0 rgba(99,102,241,0.3)',
            '0 8px 24px rgba(99,102,241,0.5), 0 0 20px rgba(99,102,241,0.4)',
            '0 8px 24px rgba(99,102,241,0.4), 0 0 0 0 rgba(99,102,241,0.3)',
          ],
        } : { boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Open chat"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
        {/* Notification dot */}
        {!open && (
          <motion.span
            className="absolute"
            style={{
              top: -2,
              right: -2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#22c55e',
              border: '2px solid rgba(8,12,28,0.95)',
            }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden"
            style={{
              width: 380,
              maxWidth: '95vw',
              height: 580,
              borderRadius: 24,
              background: 'rgba(8, 12, 28, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
            }}
          >
            {/* ── Custom Scrollbar Styles ── */}
            <style>{`
              .chat-scroll::-webkit-scrollbar { width: 4px; }
              .chat-scroll::-webkit-scrollbar-track { background: transparent; }
              .chat-scroll::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 999px; }
              .chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.5); }
              .chat-scroll { scrollbar-width: thin; scrollbar-color: rgba(99,102,241,0.3) transparent; }
            `}</style>

            {/* ── Header ── */}
            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Animated AI Avatar */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    border: '2px solid rgba(139,92,246,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  <span style={{ position: 'relative', zIndex: 1 }}>AI</span>
                  <motion.div
                    style={{
                      position: 'absolute',
                      inset: -3,
                      borderRadius: '50%',
                      border: '1.5px solid rgba(139,92,246,0.3)',
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  />
                </motion.div>
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0, lineHeight: 1.3 }}>SupplyChain Support</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <motion.span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#22c55e',
                        display: 'inline-block',
                        boxShadow: '0 0 6px #22c55e',
                      }}
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <span style={{ color: '#a78bfa', fontSize: 11, fontWeight: 500 }}>
                      SupplyChain Support
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <motion.button
                  onClick={clearChat}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    width: 34,
                    height: 34,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#a78bfa',
                    fontSize: 14,
                  }}
                  title="New chat"
                >
                  🗑️
                </motion.button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div
              className="chat-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {/* Welcome */}
              {messages.length === 0 && !streamText && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{ textAlign: 'center', padding: '20px 0', spaceY: 12 }}
                >
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))',
                    border: '1px solid rgba(99,102,241,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    margin: '0 auto 14px',
                  }}>
                    ✦
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                    👋 Hi! I'm your AI assistant.<br/>How can I help you today?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 280, margin: '0 auto' }}>
                    {SUGGESTED.map((q, i) => (
                      <motion.button
                        key={q}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.08 }}
                        onClick={() => sendMessage(q)}
                        whileHover={{ scale: 1.02, borderColor: 'rgba(139,92,246,0.5)' }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontSize: 12,
                          cursor: 'pointer',
                          background: 'rgba(99,102,241,0.08)',
                          border: '1px solid rgba(99,102,241,0.25)',
                          color: '#c4b5fd',
                          fontFamily: 'inherit',
                          transition: 'all 0.2s',
                        }}
                      >
                        💬 {q}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Message list */}
              <AnimatePresence mode="popLayout">
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    variants={messageVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ type: 'spring', stiffness: 400, damping: 28, mass: 0.8 }}
                    style={{
                      display: 'flex',
                      gap: 8,
                      justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                      marginBottom: 2,
                    }}
                  >
                    {/* Bot avatar */}
                    {m.role === 'assistant' && (
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        AI
                      </div>
                    )}

                    <div
                      className="message-bubble"
                      style={{
                        maxWidth: '78%',
                        padding: '10px 14px',
                        fontSize: 13,
                        lineHeight: 1.5,
                        borderRadius: m.role === 'user'
                          ? '18px 18px 4px 18px'
                          : '18px 18px 18px 4px',
                        background: m.role === 'user'
                          ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                          : 'rgba(255,255,255,0.06)',
                        border: m.role === 'assistant'
                          ? '1px solid rgba(255,255,255,0.08)'
                          : 'none',
                        color: m.role === 'user' ? '#fff' : '#e2e8f0',
                        wordBreak: 'break-word',
                      }}
                    >
                      <div dangerouslySetInnerHTML={{ __html: renderText(m.content) }} />
                      <p style={{
                        fontSize: 10,
                        marginTop: 4,
                        color: m.role === 'user' ? 'rgba(255,255,255,0.6)' : 'rgba(148,163,184,0.6)',
                        textAlign: m.role === 'user' ? 'right' : 'left',
                      }}>
                        {fmtTime(m.timestamp)}
                      </p>
                    </div>

                    {/* User avatar */}
                    {m.role === 'user' && (
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: 'rgba(99,102,241,0.2)',
                          border: '1px solid rgba(99,102,241,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#c4b5fd',
                          fontSize: 11,
                          fontWeight: 600,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        You
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Streaming / typing indicator */}
              {(loading || streamText) && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    AI
                  </div>
                  <div
                    style={{
                      maxWidth: '78%',
                      padding: '10px 16px',
                      fontSize: 13,
                      lineHeight: 1.5,
                      borderRadius: '18px 18px 18px 4px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#e2e8f0',
                    }}
                  >
                    {streamText ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        dangerouslySetInnerHTML={{ __html: renderText(streamText) }}
                      />
                    ) : (
                      <LoadingDots />
                    )}
                  </div>
                </div>
              )}

              {/* Human handoff notice */}
              {handoff && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    fontSize: 12,
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    color: '#fcd34d',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🤝</span>
                    <div>
                      <p style={{ margin: 0, lineHeight: 1.5 }}>
                        I'm not fully certain about this. Would you like to connect with a human agent?
                      </p>
                      <a
                        href="mailto:support@supplychain-guardian.com"
                        style={{
                          display: 'inline-block',
                          marginTop: 6,
                          color: '#a78bfa',
                          fontWeight: 600,
                          textDecoration: 'none',
                          borderBottom: '1px solid rgba(167,139,250,0.3)',
                        }}
                      >
                        → Email Human Support
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* CSAT rating */}
              {messages.length >= 2 && !rated && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    textAlign: 'center',
                    padding: '10px 0 4px',
                  }}
                >
                  <p style={{ color: '#64748b', fontSize: 11, marginBottom: 8 }}>
                    Was this helpful?
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                    {emojis.map((emoji, idx) => (
                      <motion.button
                        key={idx}
                        onClick={() => handleRate(idx + 1)}
                        whileHover={{ scale: 1.25 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                          fontSize: 22,
                          cursor: 'pointer',
                          background: selectedRating === idx + 1
                            ? 'rgba(139,92,246,0.2)'
                            : 'transparent',
                          border: selectedRating === idx + 1
                            ? '2px solid rgba(139,92,246,0.5)'
                            : '2px solid transparent',
                          borderRadius: 12,
                          padding: '4px 6px',
                          transition: 'all 0.15s',
                          boxShadow: selectedRating === idx + 1
                            ? '0 0 12px rgba(139,92,246,0.3)'
                            : 'none',
                          lineHeight: 1,
                        }}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
              {rated && (
                <motion.p
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ color: '#64748b', fontSize: 11, textAlign: 'center', margin: '6px 0' }}
                >
                  Thanks for your feedback! 🙏
                </motion.p>
              )}

              <div ref={bottomRef} />
            </div>

            {/* ── Quick Replies ── */}
            {messages.length > 0 && !loading && (
              <div
                style={{
                  padding: '8px 14px',
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  flexShrink: 0,
                }}
                className="chat-scroll"
              >
                {QUICK_REPLIES.map(q => (
                  <motion.button
                    key={q}
                    onClick={() => sendMessage(q)}
                    whileHover={{ scale: 1.03, borderColor: 'rgba(139,92,246,0.6)', boxShadow: '0 0 12px rgba(99,102,241,0.2)' }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      padding: '7px 14px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.4)',
                      color: '#a78bfa',
                      fontWeight: 500,
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s',
                    }}
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            )}

            {/* ── Input Area ── */}
            <div
              style={{
                padding: '10px 14px 12px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-end',
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type your message..."
                  rows={1}
                  disabled={loading}
                  style={{
                    width: '100%',
                    resize: 'none',
                    borderRadius: 14,
                    padding: '11px 14px',
                    fontSize: 13,
                    outline: 'none',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e2e8f0',
                    fontFamily: 'inherit',
                    minHeight: 42,
                    maxHeight: 96,
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'rgba(99,102,241,0.5)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              <motion.button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                whileHover={input.trim() && !loading ? { scale: 1.06 } : {}}
                whileTap={input.trim() && !loading ? { scale: 0.92 } : {}}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  border: 'none',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  background: input.trim() && !loading
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : 'rgba(255,255,255,0.08)',
                  color: input.trim() && !loading ? '#fff' : 'rgba(255,255,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                  boxShadow: input.trim() && !loading
                    ? '0 4px 12px rgba(99,102,241,0.3)'
                    : 'none',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </motion.button>
            </div>

            {/* ── Footer ── */}
            <p
              style={{
                textAlign: 'center',
                fontSize: 10,
                padding: '0 0 10px',
                margin: 0,
                color: 'rgba(167,139,250,0.5)',
                fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
                    SupplyChain Support ✦
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}