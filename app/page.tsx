
'use client';

import { useEffect, useState } from 'react';

type Card = {
  id: string;
  title: string;
  text: string;
  createdAt: number;
};

const BG = 'var(--bg)';
const PANEL = 'var(--panel)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const TEXT = 'var(--text)';
const ACCENT = 'var(--accent)';

export default function Page() {
  // ---------------- State ----------------
  const [cards, setCards] = useState<Card[]>(() => {
    try {
      const raw = localStorage.getItem('copyai_cards');
      if (raw) return JSON.parse(raw) as Card[];
    } catch {}
    return []; // start empty; user adds prompts
  });

  // Add form
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem('copyai_cards', JSON.stringify(cards));
    } catch {}
  }, [cards]);

  // ---------------- Utilities ----------------
  function toast(msg: string, ms = 1200) {
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed',
      right: '12px',
      bottom: '12px',
      background: SURFACE,
      color: TEXT,
      border: `1px solid ${BORDER}`,
      borderRadius: '8px',
      padding: '10px 12px',
      zIndex: '9999'
    } as CSSStyleDeclaration);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  async function copyNow(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast('✅ Copied');
    } catch {
      alert('Clipboard failed');
    }
  }

  // ---------------- Actions ----------------
  function addCard() {
    const t = title.trim();
    const x = text.trim();
    if (!t && !x) {
      toast('Enter a title or text first');
      return;
    }
    const id = 'c' + Date.now();
    const newCard: Card = { id, title: t || 'Untitled', text: x, createdAt: Date.now() };
    // Add to TOP
    setCards(prev => [...prev, newCard]);
    setTitle('');
    setText('');
    toast('➕ Added');
  }

  function startEdit(id: string) {
    const c = cards.find(c => c.id === id);
    if (!c) return;
    setEditingId(id);
    setEditTitle(c.title);
    setEditText(c.text);
  }

  function saveEdit() {
    if (!editingId) return;
    const t = editTitle.trim() || 'Untitled';
    setCards(prev => prev.map(c => c.id === editingId ? { ...c, title: t, text: editText } : c));
    setEditingId(null);
    setEditTitle('');
    setEditText('');
    toast('💾 Saved');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle('');
    setEditText('');
  }

  function removeCard(id: string) {
    if (!confirm('Delete this prompt?')) return;
    setCards(prev => prev.filter(c => c.id !== id));
    toast('🗑 Deleted');
  }

  // ---------------- Import/Export ----------------
  function exportJSON() {
    const blob = new Blob([JSON.stringify({ cards }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'prompts.json';
    a.click();
  }

  function importJSON(file: File) {
    file.text().then(t => {
      const data = JSON.parse(t);
      if (!data || !Array.isArray(data.cards)) {
        alert('Invalid file');
        return;
      }
      const norm: Card[] = data.cards.map((c: any, i: number) => ({
        id: String(c.id ?? 'c' + Date.now() + i),
        title: String(c.title ?? 'Untitled'),
        text: String(c.text ?? ''),
        createdAt: Number.isFinite(+c.createdAt) ? +c.createdAt : Date.now() - i
      }));
      // Keep newest first
      norm.sort((a, b) => b.createdAt - a.createdAt);
      setCards(norm);
      toast('📥 Imported');
    }).catch(() => alert('Failed to read file'));
  }

  // ---------------- Render ----------------
  return (
    <div
      style={{
        minHeight: '100svh',
        padding: 12,
        overflowX: 'hidden' // only vertical scrolling
      }}
    >
      {/* Header / Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>CopyAI (Web)</div>

        <button onClick={exportJSON} style={{ marginLeft: 8, background: PANEL, color: TEXT, padding: '8px 12px', borderRadius: 8 }}>
          Export
        </button>

        <label style={{ background: PANEL, color: TEXT, padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>
          Import
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files && importJSON(e.target.files[0])}
          />
        </label>

        <div style={{ marginLeft: 'auto', opacity: .7 }}>Tap a card to copy its text.</div>
      </div>

      {/* Add Form */}
      <div
        style={{
          background: PANEL,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 12,
          display: 'grid',
          gap: 8,
          marginBottom: 12
        }}
      >
        <div style={{ fontWeight: 600 }}>Add a new prompt</div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g., Outreach – Follow-up #1)"
          style={{
            width: '100%',
            background: SURFACE,
            color: TEXT,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: '10px'
          }}
        />

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Prompt text…"
          rows={5}
          style={{
            width: '100%',
            resize: 'vertical',
            background: SURFACE,
            color: TEXT,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: 10
          }}
        />

        <div>
          <button onClick={addCard} style={{ background: ACCENT, color: '#fff', padding: '10px 14px', borderRadius: 8 }}>
            ➕ Add
          </button>
        </div>
      </div>

      {/* Vertical List (newest first) */}
      <div
        style={{
          display: 'grid',
          gap: 12,
          // Vertical-only scroll behavior; cards take full width and wrap content
          overflowX: 'hidden'
        }}
      >
        {cards.length === 0 && (
          <div style={{ opacity: .7, textAlign: 'center' }}>(No prompts yet — add one above)</div>
        )}

        {cards.map((c) => {
          const isEditing = editingId === c.id;
          return (
            <div
              key={c.id}
              onClick={(e) => {
                // When editing, do not copy
                if (isEditing) return;
                // Avoid copying if clicking on an action button
                if ((e.target as HTMLElement).closest('[data-nocopy]')) return;
                copyNow(c.text);
              }}
              style={{
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: 12
              }}
            >
              {isEditing ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Title"
                    style={{
                      width: '100%',
                      background: BG,
                      color: TEXT,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: '8px 10px'
                    }}
                  />
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Text"
                    rows={5}
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      background: BG,
                      color: TEXT,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: 10
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveEdit} style={{ background: ACCENT, color: '#fff', padding: '8px 12px', borderRadius: 8 }} data-nocopy>
                      Save
                    </button>
                    <button onClick={cancelEdit} style={{ background: PANEL, color: TEXT, padding: '8px 12px', borderRadius: 8 }} data-nocopy>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{c.title || 'Untitled'}</div>
                  <div style={{ whiteSpace: 'pre-wrap', opacity: c.text ? 1 : .6 }}>
                    {c.text || '(empty)'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={() => startEdit(c.id)} style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8 }} data-nocopy>
                      Edit
                    </button>
                    <button onClick={() => removeCard(c.id)} style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8 }} data-nocopy>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
