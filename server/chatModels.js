const mongoose = require('mongoose');

// FAQ entries managed by admin
const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer:   { type: String, required: true },
  category: { type: String, default: 'General' },
  tags:     [String],
  active:   { type: Boolean, default: true },
}, { timestamps: true });

// Uploaded knowledge documents (PDFs/text)
const documentSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  type:    { type: String },         // 'pdf' | 'text' | 'policy'
  content: { type: String },         // extracted text content
  size:    { type: Number },
  active:  { type: Boolean, default: true },
}, { timestamps: true });

// Individual chat messages inside a session
const messageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user', 'assistant'] },
  content:   { type: String },
  timestamp: { type: Date, default: Date.now },
  confidence:{ type: Number, default: 1 },  // 0-1, triggers human handoff when low
}, { _id: false });

// Chat session
const chatSessionSchema = new mongoose.Schema({
  sessionId:   { type: String, required: true, unique: true },
  messages:    [messageSchema],
  userId:      { type: String, default: 'anonymous' },
  resolved:    { type: Boolean, default: false },
  handedOff:   { type: Boolean, default: false },   // escalated to human
  rating:      { type: Number, default: null },      // 1-5 CSAT score
  language:    { type: String, default: 'en' },
  unanswered:  [String],   // questions AI couldn't answer well
}, { timestamps: true });

// Analytics aggregated per day
const analyticsSchema = new mongoose.Schema({
  date:         { type: String, required: true, unique: true }, // YYYY-MM-DD
  totalChats:   { type: Number, default: 0 },
  totalUsers:   { type: Number, default: 0 },
  handoffs:     { type: Number, default: 0 },
  avgResponseMs:{ type: Number, default: 0 },
  topQuestions: [{ q: String, count: Number }],
}, { timestamps: true });

const FAQ         = mongoose.model('FAQ',         faqSchema);
const ChatDoc     = mongoose.model('ChatDoc',     documentSchema);
const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
const ChatAnalytics = mongoose.model('ChatAnalytics', analyticsSchema);

module.exports = { FAQ, ChatDoc, ChatSession, ChatAnalytics };
