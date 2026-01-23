
'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

type Card = {
  id: string;
  title: string;
  text: string;
  createdAt: number;
};

type LayoutEntry = {
  id: string;
  title: string;
  savedAt: number; // epoch ms
  cards: Card[];
};

const BG = 'var(--bg)';
const PANEL = 'var(--panel)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const TEXT = 'var(--text)';
const ACCENT = 'var(--accent)';

// Shared font size for modal header buttons
const BUTTON_FONT_SIZE = 14;

export default function Page() {
  // ----------- State: cards on the page -----------
  const [cards, setCards] = useState<Card[]>(() => {
    try {
      const raw = localStorage.getItem('copyai_cards');
      if (raw) return JSON.parse(raw) as Card[];
    } catch {}
    return []; // start empty; you add prompts
  });

  // Layout title (kept for logic; not displayed)
  const [currentLayoutTitle, setCurrentLayoutTitle] = useState<string>('');

  // Add form
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');

  // ----------- State: Library (saved layouts) -----------
  const [layouts, setLayouts] = useState<LayoutEntry[]>(() => {
    try {
      const raw = localStorage.getItem('copyai_layouts');
      if (raw) return JSON.parse(raw) as LayoutEntry[];
    } catch {}
    return [];
  });
  const [showLibrary, setShowLibrary] = useState(false);

  // ----------- UI state: temporary expand/collapse per card -----------
  // Not persisted; resets on reload.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Persist page cards + layouts
  useEffect(() => {
    try { localStorage.setItem('copyai_cards', JSON.stringify(cards)); } catch {}
  }, [cards]);
  useEffect(() => {
    try { localStorage.setItem('copyai_layouts', JSON.stringify(layouts)); } catch {}
  }, [layouts]);

  // ----------- Utilities -----------
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

  function nextUniqueTitle(base: string): string {
    const titles = new Set(layouts.map(l => l.title));
    let t = (base.trim() || 'Untitled');
    while (titles.has(t)) t = t + '-2';
    return t;
  }

  function fmt(ts: number) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  // Heuristic: decide if a text likely exceeds 3 lines and warrants a "Show more"
  function needsClamp(txt: string): boolean {
    if (!txt) return false;
    const lineCount = txt.split(/\r?\n/).length;
    return lineCount > 3 || txt.length > 240; // simple, layout-free heuristic
  }

  // ----------- Page actions: Add / Edit / Delete cards -----------
  function addCard() {
    const t = title.trim();
    const x = text.trim();
    if (!t && !x) {
      toast('Enter a title or text first');
      return;
    }
    const id = 'c' + Date.now();
    const newCard: Card = { id, title: t || 'Untitled', text: x, createdAt: Date.now() };
    // Append to bottom
    setCards(prev => [...prev, newCard]);
    setTitle('');
    setText('');
    toast('➕ Added (to bottom)');
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

  // ----------- Layout actions: Save / Open / Delete -----------
  function saveLayout() {
    if (cards.length === 0) {
      toast('Nothing to save (no prompts yet)');
      return;
    }
    const base = prompt('Layout title:', currentLayoutTitle || '') ?? '';
    const uniqueTitle = nextUniqueTitle(base);
    const entry: LayoutEntry = {
      id: 'L' + Date.now(),
      title: uniqueTitle,
      savedAt: Date.now(),
      cards
    };
    setLayouts(prev => [...prev, entry]);
    setCurrentLayoutTitle(uniqueTitle);
    toast(`💾 Saved layout: ${uniqueTitle}`);
  }

  function openLayout(id: string) {
    const lay = layouts.find(l => l.id === id);
    if (!lay) return;
    setCards(lay.cards);
    setCurrentLayoutTitle(lay.title);
    setShowLibrary(false);
    setExpanded(new Set()); // reset temp expansion on open
    toast(`📂 Opened: ${lay.title}`);
  }

  function deleteLayout(id: string) {
    const lay = layouts.find(l => l.id === id);
    if (!lay) return;
    if (!confirm(`Delete layout?\n\n${lay.title}`)) return;
    setLayouts(prev => prev.filter(l => l.id !== id));
    toast('🗑 Layout deleted');
  }

  // ----------- Import/Export (inside Library) -----------
  function exportJSON() {
    const blob = new Blob([JSON.stringify({ cards }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = 'prompts.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportLibrary() {
    const blob = new Blob([JSON.stringify({ layouts }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = 'library.json';
    a.click();
    URL.revokeObjectURL(url);
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
      // Oldest at top, newest at bottom
      norm.sort((a, b) => a.createdAt - b.createdAt);
      setCards(norm);
      setExpanded(new Set()); // reset temp expansion on import
      toast('📥 Imported');
    }).catch(() => alert('Failed to read file'));
  }

  // ----------- Styles for preview clamping (3 lines) -----------
  const LINE_HEIGHT = 1.4; // visual line-height multiplier
  const PREVIEW_LINES = 3;
  const PREVIEW_HEIGHT = `calc(${LINE_HEIGHT}em * ${PREVIEW_LINES})`;

  // Collapsed preview: fixed height (equal for all), 3 lines visible, rest hidden
  const previewCollapsedStyle: React.CSSProperties = {
    whiteSpace: 'pre-line',
    display: '-webkit-box',
    WebkitLineClamp: PREVIEW_LINES as unknown as number,
    WebkitBoxOrient: 'vertical' as unknown as 'vertical',
    overflow: 'hidden',
    lineHeight: LINE_HEIGHT as unknown as string,
    height: PREVIEW_HEIGHT,
    opacity: 1
  };

  // Expanded view: full text
  const previewExpandedStyle: React.CSSProperties = {
    whiteSpace: 'pre-wrap',
    display: 'block',
    overflow: 'visible',
    lineHeight: LINE_HEIGHT as unknown as string
  };

  // ----------- Render -----------
  return (
    <div
      style={{
        minHeight: '100svh',
        padding: 12,
        overflowX: 'hidden' // vertical scroll only
      }}
    >
      {/* Header / Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          padding: '8px 4px'
        }}
      >
        {/* Logo + App Name (CopyAI visible) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image
            src="/copyai_logo.png"
            alt="CopyAI logo"
            width={22}
            height={22}
            priority
            style={{ display: 'block' }}
          />
        <div style={{ fontWeight: 700, fontSize: 20 }}>
            CopyAI
          </div>
        </div>

        {/* Spacer pushes the buttons to the right */}
        <div style={{ marginLeft: 'auto' }} />

        {/* Primary actions aligned to the right */}
        <button
          onClick={saveLayout}
          style={{ background: ACCENT, color: '#fff', padding: '8px 12px', borderRadius: 8 }}
          title="Save current list as a layout in the Library"
        >
          💾 Save Layout
        </button>

        <button
          onClick={() => setShowLibrary(true)}
          style={{ background: PANEL, color: TEXT, padding: '8px 12px', borderRadius: 8 }}
          title="Open Library"
        >
          📚 Library
        </button>
      </div>

      {/* Add Form */}
      <div
        style={{
          background: PANEL,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 16,
          display: 'grid',
          gap: 10,
          marginBottom: 16
        }}
      >
        {/* No section title */}
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
          <button
            onClick={addCard}
            style={{ background: ACCENT, color: '#fff', padding: '10px 14px', borderRadius: 8 }}
          >
            ➕ Add (goes to bottom)
          </button>
        </div>
      </div>

      {/* Vertical List (oldest first, newest last) */}
      <div style={{ display: 'grid', gap: 12, overflowX: 'hidden' }}>
        {cards.length === 0 && (
          <div style={{ opacity: .7, textAlign: 'center' }}>(No prompts yet — add one above)</div>
        )}

        {cards.map((c) => {
          const isEditing = editingId === c.id;
          const isExpanded = expanded.has(c.id);
          const showToggle = needsClamp(c.text) || isExpanded;

          return (
            <div
              key={c.id}
              onClick={(e) => {
                if (isEditing) return;
                if ((e.target as HTMLElement).closest('[data-nocopy]')) return;
                // Copy full text on card click (primary behavior)
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

                  {/* Text + bottom-right toggle container */}
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        ...(isExpanded ? previewExpandedStyle : previewCollapsedStyle),
                        opacity: c.text ? 1 : .6
                      }}
                    >
                      {c.text || '(empty)'}
                    </div>

                    {showToggle && (
                      <button
                        data-nocopy
                        onClick={(e) => {
                          e.stopPropagation(); // do not copy text when toggling
                          toggleExpanded(c.id);
                        }}
                        aria-label={isExpanded ? 'Show less' : 'Show more'}
                        title={isExpanded ? 'Show less' : 'Show more'}
                        style={{
                          position: 'absolute',
                          right: 0,
                          bottom: 0,
                          background: PANEL,
                          color: TEXT,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontSize: 12,
                          lineHeight: 1.4,
                          cursor: 'pointer'
                        }}
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>

                  {/* Action buttons */}
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

      {/* Library Modal (with Import/Export inside) */}
      {showLibrary && (
        <div
          onClick={() => setShowLibrary(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
            display: 'grid', placeItems: 'center', zIndex: 10000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12,
              width: 'min(720px, 92vw)', maxHeight: '80vh', overflow: 'auto', padding: 16
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                justifyContent: 'space-between',
                marginBottom: 10,
                flexWrap: 'wrap',
                rowGap: 8
              }}
            >
              {/* Left cluster: Import / Export Current Layout / Export Library */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <label
                  style={{
                    background: PANEL,
                    color: TEXT,
                    padding: '6px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: `1px solid ${BORDER}`,
                    fontSize: BUTTON_FONT_SIZE
                  }}
                  title="Import a layout (JSON file with cards)"
                >
                  Import Layout From File
                  <input
                    type="file"
                    accept="application/json"
                    hidden
                    onChange={(e) => e.target.files && importJSON(e.target.files[0])}
                  />
                </label>

                <button
                  onClick={exportJSON}
                  style={{
                    background: PANEL,
                    color: TEXT,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    fontSize: BUTTON_FONT_SIZE
                  }}
                  title="Export current layout as JSON"
                >
                  Export Current Layout
                </button>

                <button
                  onClick={exportLibrary}
                  style={{
                    background: PANEL,
                    color: TEXT,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    fontSize: BUTTON_FONT_SIZE
                  }}
                  title="Export all saved layouts as JSON"
                >
                  Export Library
                </button>
              </div>

              {/* Right: Close (purple) */}
              <button
                onClick={() => setShowLibrary(false)}
                style={{
                  background: ACCENT,
                  color: '#fff',
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: BUTTON_FONT_SIZE
                }}
              >
                Close
              </button>
            </div>

            {layouts.length === 0 && <div style={{ opacity: .7 }}>(Library is empty)</div>}

            <div style={{ display: 'grid', gap: 8 }}>
              {layouts.map(l => (
                <div
                  key={l.id}
                  style={{
                    display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: `1px solid ${BORDER}`
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{l.title}</div>
                    <div style={{ opacity: .6, fontSize: 12 }}>Saved: {fmt(l.savedAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => openLayout(l.id)}
                      style={{ background: ACCENT, color: '#fff', padding: '6px 10px', borderRadius: 8 }}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => deleteLayout(l.id)}
                      style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
