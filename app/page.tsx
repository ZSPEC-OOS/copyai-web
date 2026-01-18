
'use client';

import { useEffect, useRef, useState } from 'react';

type Box = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
};

const BG = 'var(--bg)';
const PANEL = 'var(--panel)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const TEXT = 'var(--text)';
const ACCENT = 'var(--accent)';

const MIN_W = 120;
const MAX_W = 800;
const MIN_H = 80;
const MAX_H = 600;

export default function Page() {
  // ---------------- State ----------------
  const [boxes, setBoxes] = useState<Box[]>(() => {
    try {
      const raw = localStorage.getItem('copyai_boxes');
      if (raw) return JSON.parse(raw);
    } catch {}
    // seed with three boxes
    return [
      { id: 'b1', x: 20,  y: 20,  w: 220, h: 110, text: 'Prompt 1' },
      { id: 'b2', x: 260, y: 20,  w: 220, h: 110, text: 'Prompt 2' },
      { id: 'b3', x: 500, y: 20,  w: 220, h: 110, text: 'Prompt 3' },
    ];
  });

  const [newText, setNewText] = useState('');         // textarea for adding
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');       // textarea for editing
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('copyai_boxes', JSON.stringify(boxes));
    } catch {}
  }, [boxes]);

  // ---------------- Small toast ----------------
  function toast(msg: string, ms = 1200) {
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed', right: '12px', bottom: '12px',
      background: SURFACE, color: TEXT, border: `1px solid ${BORDER}`,
      borderRadius: '8px', padding: '10px 12px', zIndex: '9999'
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  // ---------------- Clipboard ----------------
  async function copyNow(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast('✅ Copied');
    } catch {
      alert('Clipboard failed');
    }
  }

  // ---------------- Add / Edit / Delete ----------------
  function addBox() {
    const txt = (newText || '').trim();
    if (!txt) {
      toast('Enter some text first');
      return;
    }
    const id = 'b' + Date.now();
    // simple auto‑position: 3 columns layout
    const colW = 240, gap = 20;
    const idx = boxes.length;
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 20 + col * (colW + gap);
    const y = 20 + row * (120 + gap);

    setBoxes(prev => [...prev, { id, x, y, w: 220, h: 110, text: txt }]);
    setNewText('');
    toast('➕ Added');
  }

  function startEdit(id: string) {
    const b = boxes.find(b => b.id === id);
    if (!b) return;
    setEditingId(id);
    setEditText(b.text);
  }
  function saveEdit() {
    if (!editingId) return;
    const txt = (editText || '').trim();
    setBoxes(prev => prev.map(b => b.id === editingId ? { ...b, text: txt || b.text } : b));
    setEditingId(null);
    setEditText('');
    toast('💾 Saved');
  }
  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }
  function removeBox(id: string) {
    if (!confirm('Delete this box?')) return;
    setBoxes(prev => prev.filter(b => b.id !== id));
    toast('🗑 Deleted');
  }

  // ---------------- Move (drag) ----------------
  function onPointerDownMove(e: React.PointerEvent, id: string) {
    // Don’t start drag if we clicked an action button
    if ((e.target as HTMLElement).closest('[data-nocopy]')) return;

    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const b = boxes.find(b => b.id === id);
    if (!b) return;
    const baseX = b.x;
    const baseY = b.y;

    function move(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setBoxes(prev => prev.map(x => x.id === id ? { ...x, x: Math.round(baseX + dx), y: Math.round(baseY + dy) } : x));
    }
    function up() {
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---------------- Resize (edge handles) ----------------
  type Edge = 'left'|'right'|'top'|'bottom';

  function onPointerDownResize(e: React.PointerEvent, id: string, edge: Edge) {
    e.stopPropagation();
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;

    const b = boxes.find(b => b.id === id);
    if (!b) return;

    const base = { x: b.x, y: b.y, w: b.w, h: b.h };

    function clampW(w: number) {
      return Math.max(MIN_W, Math.min(MAX_W, w));
    }
    function clampH(h: number) {
      return Math.max(MIN_H, Math.min(MAX_H, h));
    }

    function move(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      setBoxes(prev => prev.map(cur => {
        if (cur.id !== id) return cur;

        let x = base.x;
        let y = base.y;
        let w = base.w;
        let h = base.h;

        if (edge === 'right') {
          w = clampW(base.w + dx);
        }
        if (edge === 'left') {
          w = clampW(base.w - dx);
          // move x so the right edge stays where it was
          x = base.x + (base.w - w);
        }
        if (edge === 'bottom') {
          h = clampH(base.h + dy);
        }
        if (edge === 'top') {
          h = clampH(base.h - dy);
          y = base.y + (base.h - h);
        }

        return { ...cur, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
      }));
    }

    function up() {
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---------------- Import/Export ----------------
  function exportJSON() {
    const blob = new Blob([JSON.stringify({ boxes }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'layout.json';
    a.click();
  }
  function importJSON(file: File) {
    file.text().then(t => {
      const data = JSON.parse(t);
      if (!data || !Array.isArray(data.boxes)) {
        alert('Invalid file');
        return;
      }
      const norm: Box[] = data.boxes.map((b: any, i: number) => ({
        id: String(b.id ?? 'b' + Date.now() + i),
        x: Number.isFinite(+b.x) ? +b.x : 20,
        y: Number.isFinite(+b.y) ? +b.y : 20,
        w: Math.min(MAX_W, Math.max(MIN_W, Number.isFinite(+b.w) ? +b.w : 220)),
        h: Math.min(MAX_H, Math.max(MIN_H, Number.isFinite(+b.h) ? +b.h : 110)),
        text: String(b.text ?? '')
      }));
      setBoxes(norm);
      toast('📥 Imported');
    }).catch(() => alert('Failed to read file'));
  }

  return (
    <div style={{ minHeight: '100svh', padding: 12 }}>
      {/* Top controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>CopyAI (Web)</div>

        {/* Export / Import */}
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

        <div style={{ marginLeft: 'auto', opacity: .7 }}>Tap a box to copy its text. Drag edges to resize.</div>
      </div>

      {/* Add new prompt */}
      <div style={{
        background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12,
        display: 'grid', gap: 8, marginBottom: 12
      }}>
        <div style={{ fontWeight: 600 }}>Add a new prompt</div>
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Type or paste your prompt here…"
          rows={4}
          style={{
            width: '100%', resize: 'vertical', background: SURFACE, color: TEXT,
            border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8
          }}
        />
        <div>
          <button onClick={addBox} style={{ background: ACCENT, color: '#fff', padding: '8px 12px', borderRadius: 8 }}>
            ➕ Add
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={hostRef}
        style={{ position: 'relative', height: '65vh', overflow: 'auto', border: `1px solid ${BORDER}`, borderRadius: 12, background: BG }}
      >
        {boxes.map((b) => (
          <div
            key={b.id}
            onPointerDown={(e) => onPointerDownMove(e, b.id)}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('[data-nocopy]')) return;
              if (editingId === b.id) return; // don't copy while editing
              copyNow(b.text);
            }}
            style={{
              position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h,
              border: `2px solid ${BORDER}`, borderRadius: 16, background: SURFACE,
              display: 'flex', padding: 8
            }}
          >
            {/* Resize handles (edges). Large hit area for touch */}
            {/* Left */}
            <div
              onPointerDown={(e) => onPointerDownResize(e, b.id, 'left')}
              style={{
                position: 'absolute', left: -6, top: '50%', marginTop: -14,
                width: 12, height: 28, background: ACCENT, borderRadius: 6, opacity: .9,
                cursor: 'ew-resize'
              }}
              title="Resize left"
            />
            {/* Right */}
            <div
              onPointerDown={(e) => onPointerDownResize(e, b.id, 'right')}
              style={{
                position: 'absolute', right: -6, top: '50%', marginTop: -14,
                width: 12, height: 28, background: ACCENT, borderRadius: 6, opacity: .9,
                cursor: 'ew-resize'
              }}
              title="Resize right"
            />
            {/* Top */}
            <div
              onPointerDown={(e) => onPointerDownResize(e, b.id, 'top')}
              style={{
                position: 'absolute', top: -6, left: '50%', marginLeft: -14,
                width: 28, height: 12, background: ACCENT, borderRadius: 6, opacity: .9,
                cursor: 'ns-resize'
              }}
              title="Resize top"
            />
            {/* Bottom */}
            <div
              onPointerDown={(e) => onPointerDownResize(e, b.id, 'bottom')}
              style={{
                position: 'absolute', bottom: -6, left: '50%', marginLeft: -14,
                width: 28, height: 12, background: ACCENT, borderRadius: 6, opacity: .9,
                cursor: 'ns-resize'
              }}
              title="Resize bottom"
            />

            {/* Content */}
            {editingId === b.id ? (
              <div style={{ display: 'grid', gap: 8, width: '100%' }}>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={4}
                  style={{ width: '100%', resize: 'vertical', background: BG, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEdit} style={{ background: ACCENT, color: '#fff', padding: '6px 10px', borderRadius: 8 }} data-nocopy>
                    Save
                  </button>
                  <button onClick={cancelEdit} style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8 }} data-nocopy>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, width: '100%' }}>
                <div style={{ alignSelf: 'center', textAlign: 'center', padding: 6, overflowWrap: 'anywhere' }}>
                  {b.text || <span style={{ opacity: .6 }}>(empty)</span>}
                </div>
                <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
                  <button onClick={() => startEdit(b.id)} style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8 }} data-nocopy>
                    Edit
                  </button>
                  <button onClick={() => removeBox(b.id)} style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8 }} data-nocopy>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
