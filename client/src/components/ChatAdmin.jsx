/**
 * ChatAdmin.jsx — Admin panel for chatbot management
 * Tabs: FAQs, Documents, Chat History, Unanswered, Analytics
 */
import { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setError('Not authenticated. Please log in.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then(data => { setData(data); setError(null); })
      .catch(err => { setError(err.message); })
      .finally(() => setLoading(false));
  };
  useEffect(load, deps);
  return { data, loading, error, reload: load };
}

const CATEGORIES = ['General', 'Orders', 'Technical', 'Billing', 'Policy'];

// ── FAQ Manager ───────────────────────────────────────────────────────────────
function FAQManager() {
  const { data: faqs, loading, error, reload } = useApi('/api/admin/faqs');
  const [form, setForm]   = useState({ question: '', answer: '', category: 'General', tags: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const token = localStorage.getItem('auth_token');

  const save = async () => {
    if (!form.question || !form.answer) return alert('Question and answer required');
    setSaving(true);
    const body = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
    const url  = editId ? `${API}/api/admin/faqs/${editId}` : `${API}/api/admin/faqs`;
    await fetch(url, {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setForm({ question: '', answer: '', category: 'General', tags: '' });
    setEditId(null);
    setSaving(false);
    reload();
  };

  const del = async (id) => {
    if (!confirm('Delete this FAQ?')) return;
    await fetch(`${API}/api/admin/faqs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    reload();
  };

  const startEdit = (faq) => {
    setEditId(faq._id);
    setForm({ question: faq.question, answer: faq.answer, category: faq.category || 'General', tags: (faq.tags || []).join(', ') });
  };

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">{error}</div>}
      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{editId ? 'Edit FAQ' : 'Add New FAQ'}</h3>
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
          placeholder="Question" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
        <textarea value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
          placeholder="Answer" rows={3}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm resize-none bg-white dark:bg-gray-700 dark:text-white" />
        <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
          placeholder="Tags (comma separated)" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : editId ? 'Update' : 'Add FAQ'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ question: '', answer: '', category: 'General', tags: '' }); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200">
            Cancel
          </button>}
        </div>
      </div>

      {/* FAQ List */}
      <div className="space-y-2">
        {(faqs || []).map(faq => (
          <div key={faq._id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{faq.category}</span>
                  {!faq.active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500">Inactive</span>}
                </div>
                <p className="font-medium text-sm text-gray-800 dark:text-gray-100">{faq.question}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{faq.answer}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => startEdit(faq)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg">✏️</button>
                <button onClick={() => del(faq._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">🗑️</button>
              </div>
            </div>
          </div>
        ))}
        {faqs?.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No FAQs yet. Add your first one above.</p>}
      </div>
    </div>
  );
}

// ── Document Manager ──────────────────────────────────────────────────────────
function DocManager() {
  const { data: docs, loading, error, reload } = useApi('/api/admin/docs');
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const token = localStorage.getItem('auth_token');

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    await fetch(`${API}/api/admin/docs`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
    });
    setUploading(false);
    reload();
    fileRef.current.value = '';
  };

  const del = async (id) => {
    if (!confirm('Delete document?')) return;
    await fetch(`${API}/api/admin/docs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    reload();
  };

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">{error}</div>}
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-3 text-sm">Upload PDFs, policy docs, or support guides<br/><span className="text-xs">Max 5MB · PDF, TXT, MD supported</span></p>
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md" onChange={upload} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {uploading ? 'Uploading…' : '📁 Choose File'}
        </button>
      </div>
      <div className="space-y-2">
        {(docs || []).map(doc => (
          <div key={doc._id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-gray-800 dark:text-gray-100">{doc.name}</p>
              <p className="text-xs text-gray-400">{doc.type?.toUpperCase()} · {(doc.size / 1024).toFixed(1)} KB · {new Date(doc.createdAt).toLocaleDateString()}</p>
            </div>
            <button onClick={() => del(doc._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">🗑️</button>
          </div>
        ))}
        {docs?.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No documents uploaded yet.</p>}
      </div>
    </div>
  );
}

// ── Chat History ──────────────────────────────────────────────────────────────
function ChatHistory() {
  const { data, loading, error, reload } = useApi('/api/admin/chats');
  const [selected, setSelected] = useState(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {error && <div className="md:col-span-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">{error}</div>}
      <div className="space-y-2 overflow-y-auto max-h-[500px]">
        {(data?.sessions || []).map(s => (
          <button key={s._id} onClick={() => setSelected(s)}
            className={`w-full text-left bg-white dark:bg-gray-800 border rounded-xl p-3 hover:border-blue-400 transition ${selected?._id === s._id ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-gray-500 truncate">{s.sessionId?.substring(0,12)}…</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.handedOff ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {s.handedOff ? 'Escalated' : 'Resolved'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{s.messages?.length || 0} messages · {new Date(s.createdAt).toLocaleString()}</p>
            {s.rating && <p className="text-xs mt-1">⭐ Rating: {s.rating}/5</p>}
          </button>
        ))}
        {!data?.sessions?.length && <p className="text-center text-gray-400 text-sm py-8">No chat history yet.</p>}
      </div>

      {/* Session detail */}
      {selected && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 overflow-y-auto max-h-[500px]">
          <h4 className="font-semibold text-sm mb-3 text-gray-800 dark:text-gray-100">Session: {selected.sessionId?.substring(0,16)}…</h4>
          <div className="space-y-2">
            {(selected.messages || []).map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                }`}>
                  <p>{m.content}</p>
                  {m.confidence < 0.5 && <p className="text-yellow-400 text-[10px] mt-1">⚠ Low confidence</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Unanswered Questions ──────────────────────────────────────────────────────
function UnansweredPanel() {
  const { data, loading, error } = useApi('/api/admin/chats/unanswered');
  return (
    <div className="space-y-2">
      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">{error}</div>}
      {(data || []).map((item, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">❓ {item.q}</p>
          <p className="text-xs text-gray-400 mt-1">Session: {item.sessionId?.substring(0,12)}… · {new Date(item.date).toLocaleDateString()}</p>
        </div>
      ))}
      {data?.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No unanswered questions 🎉</p>}
    </div>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function AnalyticsPanel() {
  const { data, loading, error } = useApi('/api/admin/analytics');
  if (!data) return <p className="text-center text-gray-400 text-sm py-8">Loading analytics…</p>;
  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">{error}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Chats', value: data.totalChats, icon: '💬' },
          { label: 'Avg CSAT', value: data.avgCSAT ? `${data.avgCSAT}/5` : 'N/A', icon: '⭐' },
          { label: 'Escalations', value: data.totalHandoffs, icon: '🤝' },
          { label: 'Days Tracked', value: data.daily?.length || 0, icon: '📅' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
            <p className="text-2xl">{icon}</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-1">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Top questions from latest day */}
      {data.daily?.[0]?.topQuestions?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <h4 className="font-semibold text-sm mb-3 text-gray-800 dark:text-gray-100">🔥 Top Questions (Today)</h4>
          <div className="space-y-2">
            {data.daily[0].topQuestions.slice(0, 8).sort((a, b) => b.count - a.count).map((q, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-xs text-gray-600 dark:text-gray-300 flex-1 truncate">{q.q}</p>
                <span className="text-xs font-semibold text-blue-600 ml-2">{q.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────────────────────
export default function ChatAdmin() {
  const [tab, setTab] = useState('faqs');
  const tabs = [
    { id: 'faqs', label: '❓ FAQs' },
    { id: 'docs', label: '📄 Documents' },
    { id: 'history', label: '💬 Chat History' },
    { id: 'unanswered', label: '⚠️ Unanswered' },
    { id: 'analytics', label: '📊 Analytics' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🤖 Chatbot Admin Panel</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage FAQs, documents, and monitor chat performance</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'faqs'        && <FAQManager />}
        {tab === 'docs'        && <DocManager />}
        {tab === 'history'     && <ChatHistory />}
        {tab === 'unanswered'  && <UnansweredPanel />}
        {tab === 'analytics'   && <AnalyticsPanel />}
      </div>
    </div>
  );
}
