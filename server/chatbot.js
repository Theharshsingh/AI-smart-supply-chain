/**
 * chatbot.js — AI Chatbot API routes
 * Integrates: Google Gemini API, RAG (FAQ + docs), MongoDB sessions, Admin panel
 */
require('dotenv').config();
const express    = require('express');
const multer     = require('multer');
const rateLimit  = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { FAQ, ChatDoc, ChatSession, ChatAnalytics } = require('./chatModels');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL   = 'gemini-flash-latest';
const GEMINI_URL     = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  : null;
const GEMINI_STREAM_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`
  : null;

if (!GEMINI_API_KEY) {
  console.warn('[Chatbot] WARNING: GEMINI_API_KEY is not set. Chatbot will return error messages.');
}

// ── Rate limiter: 30 req/min per IP ──────────────────────────────────────────
const chatLimiter = rateLimit({ windowMs: 60_000, max: 30, message: { error: 'Too many requests, slow down.' } });

// ── Multer: in-memory file upload (PDFs/text) ─────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.pdf') || file.originalname.endsWith('.txt') || file.originalname.endsWith('.md')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, MD files allowed'));
    }
  },
});

// ── Company knowledge base (static) ──────────────────────────────────────────
const COMPANY_KNOWLEDGE = `
You are a helpful customer support agent for SupplyChain Guardian — an AI-powered supply chain and logistics platform.

COMPANY INFO:
- Product: SupplyChain Guardian — real-time disruption detection & route optimization
- Website: AI-Smart Supply Chain platform
- Support Email: support@supplychain-guardian.com
- Business Hours: Mon-Sat 9AM-6PM IST
- Response Time: Within 24 hours

FEATURES:
- Real-time shipment tracking with GPS
- AI-powered route optimization (Road, Train, Air)
- Weather & traffic disruption alerts
- Live map with route visualization
- Risk scoring for shipments
- Driver management panel
- Customer & Admin dashboards

ACCOUNT & AUTH:
- Create account: Click Sign Up on the homepage, enter name/email/password
- Login: Use registered email and password on the Login page
- Password reset: Click "Forgot Password" on login page, check your email
- Profile update: Go to Settings > Profile after logging in
- Roles: Customer, Driver, Admin

ORDERS & SERVICES:
- Place order: Login > Dashboard > Create Order > fill pickup/delivery details
- Track order: Login > My Orders > click on order for live tracking
- Order status: Pending → Assigned → In Transit → Delivered
- Delivery time: Depends on distance and route; shown during order creation
- Cancellation: Cancel before driver assignment from My Orders page
- Refund: Processed within 5-7 business days after cancellation
- Returns: Contact support within 48 hours of delivery
- Payment methods: UPI, Credit/Debit Card, Net Banking, Wallet
- Failed payment: Retry after 5 minutes; check bank if amount debited
- Discounts: Available via promo codes at checkout

TECHNICAL SUPPORT:
- Website not loading: Clear cache, try incognito, check internet
- Login issues: Verify email, reset password, check caps lock
- OTP not received: Check spam folder, wait 2 min, use resend option
- Payment failed: Check card limits, try different payment method
- Map not loading: Enable location permissions, refresh page
- GPS issues: Allow location access in browser settings
- Route issues: Try refreshing, check if origin/destination are valid
- Account verification: Check email inbox and spam for verification link

PRICING:
- Free Plan: Basic tracking, 5 shipments/month
- Starter ₹999/month: 50 shipments, route optimization
- Business ₹2999/month: Unlimited shipments, advanced analytics, priority support
- Enterprise: Custom pricing — contact sales

POLICIES:
- Privacy Policy: We never share user data with third parties
- Data retention: 90 days for tracking data
- SLA: 99.9% uptime guarantee

LANGUAGE: You understand and respond in English, Hindi, and Hinglish naturally.
If user writes in Hindi, respond in Hindi. If Hinglish, respond in Hinglish.

IMPORTANT RULES:
- Never make up prices, policies, or features not listed above
- If unsure, say: "I'm not fully certain about this. Let me connect you with our support team."
- Always be polite, concise, and helpful
- Ask follow-up questions if the user's issue is unclear
`;

// ── RAG: search FAQs and docs for relevant context ───────────────────────────
async function retrieveContext(query) {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length > 3);

  // Search FAQs
  const faqs = await FAQ.find({ active: true })
    .select('question answer category')
    .lean();

  const matchedFaqs = faqs
    .filter(f => words.some(w => f.question.toLowerCase().includes(w) || f.answer.toLowerCase().includes(w)))
    .slice(0, 3)
    .map(f => `Q: ${f.question}\nA: ${f.answer}`)
    .join('\n\n');

  // Search docs
  const docs = await ChatDoc.find({ active: true }).select('name content').lean();
  const matchedDocs = docs
    .filter(d => d.content && words.some(w => d.content.toLowerCase().includes(w)))
    .slice(0, 2)
    .map(d => `[${d.name}]: ${d.content.substring(0, 500)}`)
    .join('\n\n');

  return [matchedFaqs, matchedDocs].filter(Boolean).join('\n\n');
}

// ── Build Gemini prompt ───────────────────────────────────────────────────────
function buildPrompt(messages, ragContext) {
  const contextSection = ragContext
    ? `\nRELEVANT KNOWLEDGE BASE:\n${ragContext}\n`
    : '';

  return {
    system_instruction: { parts: [{ text: COMPANY_KNOWLEDGE + contextSection }] },
    contents: messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      topP: 0.8,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };
}

// ── Detect low-confidence triggers ───────────────────────────────────────────
function detectLowConfidence(text) {
  const triggers = ['not sure', 'not certain', 'cannot find', "don't have information", 'unclear', 'contact support', 'not fully certain'];
  return triggers.some(t => text.toLowerCase().includes(t)) ? 0.4 : 0.9;
}

// ── Update daily analytics ────────────────────────────────────────────────────
async function updateAnalytics(isNewSession, isHandoff, responseMs, question) {
  const date = new Date().toISOString().split('T')[0];
  const update = {
    $inc: { avgResponseMs: responseMs },
    $setOnInsert: { date },
  };
  if (isNewSession) { update.$inc.totalChats = 1; update.$inc.totalUsers = 1; }
  if (isHandoff)    update.$inc.handoffs = 1;

  await ChatAnalytics.findOneAndUpdate({ date }, update, { upsert: true });

  // Track top question
  if (question) {
    await ChatAnalytics.findOneAndUpdate(
      { date, 'topQuestions.q': question },
      { $inc: { 'topQuestions.$.count': 1 } }
    ).then(async (found) => {
      if (!found) {
        await ChatAnalytics.findOneAndUpdate({ date }, {
          $push: { topQuestions: { q: question.substring(0, 100), count: 1 } }
        });
      }
    }).catch(() => {});
  }
}

// ── Sanitize input (XSS prevention) ──────────────────────────────────────────
function sanitize(str = '') {
  return str.replace(/<[^>]*>/g, '').replace(/[<>'"]/g, '').trim().substring(0, 2000);
}

// ── Register all chatbot routes ───────────────────────────────────────────────
function registerChatbotRoutes(app, authMiddleware, adminOnly) {

  // ── POST /api/chat/message — main chat endpoint (SSE streaming) ─────────────
  app.post('/api/chat/message', chatLimiter, async (req, res) => {
    const { sessionId: rawSid, message: rawMsg, userId = 'anonymous' } = req.body;

    if (!rawMsg) return res.status(400).json({ error: 'message required' });
    const message   = sanitize(rawMsg);
    const sessionId = rawSid || uuidv4();
    const startTime = Date.now();

    try {
      // Check if Gemini API is configured
      if (!GEMINI_URL) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Session-Id', sessionId);
        res.flushHeaders();
        const fallbackText = "I'm sorry, the AI chat service is not fully configured yet. Please contact the administrator to set up the GEMINI_API_KEY. In the meantime, you can reach our support team at support@supplychain-guardian.com.";
        res.write(`data: ${JSON.stringify({ chunk: fallbackText, sessionId })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, sessionId, confidence: 0.4, handoff: true })}\n\n`);
        res.end();
        return;
      }

      // Load or create session
      let session = await ChatSession.findOne({ sessionId });
      const isNew = !session;
      if (!session) {
        session = new ChatSession({ sessionId, userId, messages: [] });
      }

      // Keep last 10 messages for context window
      const recentMessages = session.messages.slice(-10);

      // RAG retrieval
      const ragContext = await retrieveContext(message);

      // Build Gemini payload
      const payload = buildPrompt([...recentMessages, { role: 'user', content: message }], ragContext);

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Session-Id', sessionId);
      res.flushHeaders();

      // Call Gemini non-streaming (more reliable across all environments)
      const fetch = require('node-fetch');
      const geminiRes = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      const geminiJson = await geminiRes.json();

      if (!geminiRes.ok) {
        console.error('[Gemini Error]', JSON.stringify(geminiJson));
        res.write(`data: ${JSON.stringify({ error: 'AI service unavailable: ' + (geminiJson?.error?.message || geminiRes.status), sessionId })}\n\n`);
        return res.end();
      }

      const finishReason = geminiJson?.candidates?.[0]?.finishReason;
      const fullText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
        (finishReason === 'MAX_TOKENS' ? 'Sorry, response was too long. Please ask a more specific question.' : 'Sorry, I could not generate a response. Please try again.');

      // Simulate streaming by sending the full text as chunks (word by word feel)
      const words = fullText.split(' ');
      for (let i = 0; i < words.length; i += 4) {
        const chunk = words.slice(i, i + 4).join(' ') + (i + 4 < words.length ? ' ' : '');
        res.write(`data: ${JSON.stringify({ chunk, sessionId })}\n\n`);
      }

      const confidence = detectLowConfidence(fullText);
      const responseMs = Date.now() - startTime;

      // Persist messages
      session.messages.push({ role: 'user', content: message });
      session.messages.push({ role: 'assistant', content: fullText, confidence });
      if (confidence < 0.5) {
        session.handedOff = true;
        session.unanswered.push(message);
      }
      await session.save();

      // Analytics
      await updateAnalytics(isNew, confidence < 0.5, responseMs, message).catch(() => {});

      // Send final done event
      res.write(`data: ${JSON.stringify({ done: true, sessionId, confidence, handoff: confidence < 0.5 })}\n\n`);
      res.end();

    } catch (err) {
      console.error('[Chat]', err);
      res.write(`data: ${JSON.stringify({ error: 'Internal error', sessionId })}\n\n`);
      res.end();
    }
  });

  // ── GET /api/chat/session/:id — load session history ───────────────────────
  app.get('/api/chat/session/:sessionId', async (req, res) => {
    const session = await ChatSession.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.json({ messages: [], sessionId: req.params.sessionId });
    res.json({ messages: session.messages, sessionId: session.sessionId });
  });

  // ── POST /api/chat/rate — customer CSAT rating ─────────────────────────────
  app.post('/api/chat/rate', async (req, res) => {
    const { sessionId, rating } = req.body;
    if (!sessionId || !rating) return res.status(400).json({ error: 'sessionId and rating required' });
    await ChatSession.findOneAndUpdate({ sessionId }, { rating });
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // ── FAQ CRUD ───────────────────────────────────────────────────────────────
  app.get('/api/admin/faqs', authMiddleware, adminOnly, async (req, res) => {
    res.json(await FAQ.find().sort({ createdAt: -1 }).lean());
  });

  app.post('/api/admin/faqs', authMiddleware, adminOnly, async (req, res) => {
    const { question, answer, category, tags } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });
    const faq = await FAQ.create({ question: sanitize(question), answer: sanitize(answer), category, tags });
    res.json(faq);
  });

  app.put('/api/admin/faqs/:id', authMiddleware, adminOnly, async (req, res) => {
    const { question, answer, category, tags, active } = req.body;
    const faq = await FAQ.findByIdAndUpdate(req.params.id,
      { question: sanitize(question), answer: sanitize(answer), category, tags, active },
      { new: true }
    );
    if (!faq) return res.status(404).json({ error: 'Not found' });
    res.json(faq);
  });

  app.delete('/api/admin/faqs/:id', authMiddleware, adminOnly, async (req, res) => {
    await FAQ.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  });

  // ── Document Upload ────────────────────────────────────────────────────────
  app.post('/api/admin/docs', authMiddleware, adminOnly, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let content = '';
    if (req.file.mimetype === 'text/plain' || req.file.mimetype === 'text/markdown') {
      content = req.file.buffer.toString('utf-8').substring(0, 50000);
    } else if (req.file.originalname.endsWith('.pdf')) {
      // Basic PDF text extraction (strips binary, keeps readable text)
      content = req.file.buffer.toString('latin1')
        .replace(/[^\x20-\x7E\n\r]/g, ' ')
        .replace(/\s+/g, ' ')
        .substring(0, 50000);
    }

    const doc = await ChatDoc.create({
      name:    req.file.originalname,
      type:    req.file.originalname.endsWith('.pdf') ? 'pdf' : 'text',
      content,
      size:    req.file.size,
    });
    res.json(doc);
  });

  app.get('/api/admin/docs', authMiddleware, adminOnly, async (req, res) => {
    res.json(await ChatDoc.find().sort({ createdAt: -1 }).lean());
  });

  app.delete('/api/admin/docs/:id', authMiddleware, adminOnly, async (req, res) => {
    await ChatDoc.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  });

  // ── Chat Sessions (history) ────────────────────────────────────────────────
  app.get('/api/admin/chats', authMiddleware, adminOnly, async (req, res) => {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const [sessions, total] = await Promise.all([
      ChatSession.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ChatSession.countDocuments(),
    ]);
    res.json({ sessions, total, page });
  });

  app.get('/api/admin/chats/unanswered', authMiddleware, adminOnly, async (req, res) => {
    const sessions = await ChatSession.find({ unanswered: { $exists: true, $not: { $size: 0 } } })
      .select('unanswered sessionId createdAt').lean();
    const all = sessions.flatMap(s => s.unanswered.map(q => ({ q, sessionId: s.sessionId, date: s.createdAt })));
    res.json(all);
  });

  // ── Analytics ──────────────────────────────────────────────────────────────
  app.get('/api/admin/analytics', authMiddleware, adminOnly, async (req, res) => {
    const [analytics, totalSessions, avgRating, handoffCount] = await Promise.all([
      ChatAnalytics.find().sort({ date: -1 }).limit(30).lean(),
      ChatSession.countDocuments(),
      ChatSession.aggregate([{ $match: { rating: { $ne: null } } }, { $group: { _id: null, avg: { $avg: '$rating' } } }]),
      ChatSession.countDocuments({ handedOff: true }),
    ]);
    res.json({
      daily: analytics,
      totalChats: totalSessions,
      avgCSAT: avgRating[0]?.avg?.toFixed(1) || 'N/A',
      totalHandoffs: handoffCount,
    });
  });
}

module.exports = { registerChatbotRoutes };
