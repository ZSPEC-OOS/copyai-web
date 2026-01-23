
'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

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

type DocFolder = {
  id: string;
  name: string;
  createdAt: number;
};

type DocFile = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  folderId: string | null; // null => Unfiled
};

type DocumentLibrary = {
  folders: DocFolder[];
  files: DocFile[];
};

const BG = 'var(--bg)';
const PANEL = 'var(--panel)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const TEXT = 'var(--text)';
const ACCENT = 'var(--accent)';

// Shared font size for modal header buttons
const BUTTON_FONT_SIZE = 14;

// Uniform style so label-based "buttons" match actual <button> elements
const LIB_BTN_STYLE: React.CSSProperties = {
  background: PANEL,
  color: TEXT,
  padding: '6px 10px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  fontSize: BUTTON_FONT_SIZE,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1.2,
  cursor: 'pointer'
};

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

  // ----------- State: Document Library -----------
  const [docLib, setDocLib] = useState<DocumentLibrary>(() => {
    try {
      const raw = localStorage.getItem('copyai_doclib');
      if (raw) return JSON.parse(raw) as DocumentLibrary;
    } catch {}
    return { folders: [], files: [] };
  });

  // UI: which tab inside the modal: layouts | docs
  const [libraryTab, setLibraryTab] = useState<'layouts' | 'docs'>('layouts');

  // Show the library modal
  const [showLibrary, setShowLibrary] = useState(false);

  // ----------- UI state: temporary expand/collapse per card -----------
  // Not persisted; resets on reload.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Document Library: folders filter and preview
  type SpecialFolder = 'all' | 'unfiled';
  const [activeFolder, setActiveFolder] = useState<string | SpecialFolder>('all');
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  // Persist page cards + layouts + doclib
  useEffect(() => {
    try { localStorage.setItem('copyai_cards', JSON.stringify(cards)); } catch {}
  }, [cards]);
  useEffect(() => {
    try { localStorage.setItem('copyai_layouts', JSON.stringify(layouts)); } catch {}
  }, [layouts]);
  useEffect(() => {
    try { localStorage.setItem('copyai_doclib', JSON.stringify(docLib)); } catch {}
  }, [docLib]);

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

  // ----------- Import/Export (Layouts) -----------
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

  function importLibraryLayouts(file: File) {
    file.text().then(t => {
      let data: any;
      try {
        data = JSON.parse(t);
      } catch {
        alert('Invalid JSON');
        return;
      }

      const incoming = Array.isArray(data) ? data : data?.layouts;
      if (!Array.isArray(incoming)) {
        alert('Invalid library file (expected { "layouts": [...] })');
        return;
      }

      const existingTitles = new Set(layouts.map(l => l.title));
      const normalized: LayoutEntry[] = incoming.map((l: any, li: number) => {
        // normalize cards
        const cardsArr: Card[] = Array.isArray(l?.cards) ? l.cards.map((c: any, i: number) => ({
          id: String(c?.id ?? 'c' + Date.now() + '_' + li + '_' + i),
          title: String(c?.title ?? 'Untitled'),
          text: String(c?.text ?? ''),
          createdAt: Number.isFinite(+c?.createdAt) ? +c.createdAt : (Date.now() - i)
        })) : [];

        cardsArr.sort((a, b) => a.createdAt - b.createdAt);

        let title = String(l?.title ?? 'Untitled').trim() || 'Untitled';
        while (existingTitles.has(title)) title = title + '-2';
        existingTitles.add(title);

        const savedAt = Number.isFinite(+l?.savedAt) ? +l.savedAt : Date.now() - li;

        return {
          id: 'L' + Date.now() + '_' + li,
          title,
          savedAt,
          cards: cardsArr
        };
      });

      if (normalized.length === 0) {
        toast('ℹ️ No layouts found in file');
        return;
      }

      setLayouts(prev => [...prev, ...normalized]);
      toast(`📚 Imported ${normalized.length} layout${normalized.length > 1 ? 's' : ''}`);
    }).catch(() => alert('Failed to read file'));
  }

  // ----------- Document Library: helpers -----------
  function createFolder() {
    let name = prompt('New folder name:', 'New Folder') ?? '';
    name = name.trim();
    if (!name) return;

    // enforce uniqueness by suffixing -2 if needed
    const existing = new Set(docLib.folders.map(f => f.name));
    let finalName = name;
    while (existing.has(finalName)) finalName = finalName + '-2';

    const folder: DocFolder = { id: 'F' + Date.now(), name: finalName, createdAt: Date.now() };
    setDocLib(prev => ({ ...prev, folders: [...prev.folders, folder] }));
    setActiveFolder(folder.id);
    toast(`📁 Created folder: ${finalName}`);
  }

  function renameFolder(folderId: string) {
    const folder = docLib.folders.find(f => f.id === folderId);
    if (!folder) return;
    let name = prompt('Rename folder:', folder.name) ?? '';
    name = name.trim();
    if (!name || name === folder.name) return;

    const taken = new Set(docLib.folders.filter(f => f.id !== folderId).map(f => f.name));
    let finalName = name;
    while (taken.has(finalName)) finalName = finalName + '-2';

    setDocLib(prev => ({
      ...prev,
      folders: prev.folders.map(f => f.id === folderId ? { ...f, name: finalName } : f)
    }));
    toast(`✏️ Renamed to: ${finalName}`);
  }

  function deleteFolder(folderId: string) {
    const folder = docLib.folders.find(f => f.id === folderId);
    if (!folder) return;
    if (!confirm(`Delete folder "${folder.name}"?\n\nFiles will be moved to Unfiled.`)) return;

    setDocLib(prev => ({
      folders: prev.folders.filter(f => f.id !== folderId),
      files: prev.files.map(file => file.folderId === folderId ? { ...file, folderId: null, updatedAt: Date.now() } : file)
    }));
    if (activeFolder === folderId) setActiveFolder('unfiled');
    toast('🗂️ Folder deleted (files moved to Unfiled)');
  }

  function uploadTxtFiles(fileList: FileList, target: string | SpecialFolder) {
    const files = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.txt'));
    if (files.length === 0) {
      alert('Please select .txt files');
      return;
    }
    const folderId = target === 'unfiled' || target === 'all' ? null : target;

    Promise.all(files.map((f, i) =>
      f.text().then(content => {
        const now = Date.now();
        const safeName = f.name.replace(/\s+/g, ' ').trim() || `Document ${now + i}.txt`;
        const uniqueName = uniqueFileName(safeName, folderId);
        const doc: DocFile = {
          id: 'D' + now + '_' + i,
          name: uniqueName,
          content,
          createdAt: now,
          updatedAt: now,
          folderId
        };
        return doc;
      })
    )).then(newDocs => {
      setDocLib(prev => ({ ...prev, files: [...prev.files, ...newDocs] }));
      toast(`📄 Uploaded ${newDocs.length} file${newDocs.length > 1 ? 's' : ''}`);
    }).catch(() => alert('Failed to read one or more files'));
  }

  function uniqueFileName(base: string, folderId: string | null): string {
    const names = new Set(docLib.files.filter(f => f.folderId === folderId).map(f => f.name));
    let name = base;
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    while (names.has(name)) name = `${stem}-2${ext}`;
    return name;
  }

  function renameFile(fileId: string) {
    const file = docLib.files.find(f => f.id === fileId);
    if (!file) return;
    let name = prompt('Rename file:', file.name) ?? '';
    name = name.trim();
    if (!name || name === file.name) return;

    const unique = uniqueFileName(name, file.folderId);
    setDocLib(prev => ({
      ...prev,
      files: prev.files.map(f => f.id === fileId ? { ...f, name: unique, updatedAt: Date.now() } : f)
    }));
    toast('✏️ File renamed');
  }

  function deleteFile(fileId: string) {
    const file = docLib.files.find(f => f.id === fileId);
    if (!file) return;
    if (!confirm(`Delete "${file.name}"?`)) return;
    setDocLib(prev => ({ ...prev, files: prev.files.filter(f => f.id !== fileId) }));
    if (previewDocId === fileId) setPreviewDocId(null);
    toast('🗑 File deleted');
  }

  function moveFile(fileId: string, newFolder: string | SpecialFolder) {
    const folderId = newFolder === 'all' || newFolder === 'unfiled' ? null : newFolder;
    setDocLib(prev => ({
      ...prev,
      files: prev.files.map(f => f.id === fileId ? { ...f, folderId, updatedAt: Date.now() } : f)
    }));
    toast('📦 Moved');
  }

  // ----------- Import/Export (Document Library) -----------
  function exportDocLibrary() {
    const blob = new Blob([JSON.stringify({ docLib }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = 'document_library.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importDocLibrary(file: File) {
    file.text().then(t => {
      let data: any;
      try {
        data = JSON.parse(t);
      } catch {
        alert('Invalid JSON');
        return;
      }

      // Accept shapes:
      // - { docLib: { folders:[], files:[] } }
      // - { folders:[], files:[] }
      const payload: DocumentLibrary | undefined =
        data?.docLib && data.docLib.folders && data.docLib.files
          ? data.docLib
          : (data?.folders && data?.files ? data : undefined);

      if (!payload || !Array.isArray(payload.folders) || !Array.isArray(payload.files)) {
        alert('Invalid document library file');
        return;
      }

      // Normalize folders
      const existingFolderNames = new Set(docLib.folders.map(f => f.name));
      const folderIdMap = new Map<string, string>(); // incomingId -> newId

      const normalizedFolders: DocFolder[] = payload.folders.map((f: any, i: number) => {
        const now = Date.now();
        let name = String(f?.name ?? 'Imported Folder').trim() || 'Imported Folder';
        while (existingFolderNames.has(name)) name = name + '-2';
        existingFolderNames.add(name);
        const id = 'F' + now + '_' + i;
        folderIdMap.set(String(f?.id ?? 'F_in_' + i), id);
        return {
          id,
          name,
          createdAt: Number.isFinite(+f?.createdAt) ? +f.createdAt : now - i
        };
      });

      // Normalize files
      const normalizedFiles: DocFile[] = payload.files.map((fi: any, i: number) => {
        const now = Date.now();
        const inFolder = fi?.folderId ?? null;
        const mappedFolder = inFolder === null ? null : (folderIdMap.get(String(inFolder)) ?? null);
        const nameRaw = String(fi?.name ?? `Imported ${now + i}.txt`);
        const targetFolder = mappedFolder;
        const uniqueName = uniqueNameForImport(nameRaw, targetFolder);

        return {
          id: 'D' + now + '_' + i,
          name: uniqueName,
          content: String(fi?.content ?? ''),
          createdAt: Number.isFinite(+fi?.createdAt) ? +fi.createdAt : now - i,
          updatedAt: Number.isFinite(+fi?.updatedAt) ? +fi.updatedAt : now - i,
          folderId: targetFolder
        };
      });

      setDocLib(prev => ({
        folders: [...prev.folders, ...normalizedFolders],
        files: [...prev.files, ...normalizedFiles]
      }));
      toast(`📥 Imported ${normalizedFiles.length} file${normalizedFiles.length !== 1 ? 's' : ''} and ${normalizedFolders.length} folder${normalizedFolders.length !== 1 ? 's' : ''}`);
    }).catch(() => alert('Failed to read file'));
  }

  function uniqueNameForImport(base: string, folderId: string | null): string {
    const names = new Set(docLib.files.filter(f => f.folderId === folderId).map(f => f.name));
    let name = base.trim() || 'Imported.txt';
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    while (names.has(name)) name = `${stem}-2${ext}`;
    return name;
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

  // ----------- Memo: files filtered by activeFolder -----------
  const filteredFiles = useMemo(() => {
    if (activeFolder === 'all') return docLib.files;
    if (activeFolder === 'unfiled') return docLib.files.filter(f => f.folderId === null);
    return docLib.files.filter(f => f.folderId === activeFolder);
  }, [docLib.files, activeFolder]);

  const previewDoc = previewDocId ? docLib.files.find(f => f.id === previewDocId) : null;

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
          onClick={() => { setLibraryTab('layouts'); setShowLibrary(true); }}
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

      {/* Library Modal (Layouts + Document Library) */}
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
              width: 'min(900px, 94vw)', maxHeight: '84vh', overflow: 'auto', padding: 16
            }}
          >
            {/* Modal Toolbar */}
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
              {/* Left cluster (varies by tab) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {libraryTab === 'layouts' ? (
                  <>
                    {/* Import current layout (cards) */}
                    <label style={LIB_BTN_STYLE} title="Import a layout (JSON file with cards)">
                      Import Layout From File
                      <input
                        type="file"
                        accept="application/json"
                        hidden
                        onChange={(e) => e.target.files && importJSON(e.target.files[0])}
                      />
                    </label>

                    {/* Export current layout (cards) */}
                    <button
                      onClick={exportJSON}
                      style={LIB_BTN_STYLE}
                      title="Export current layout as JSON"
                    >
                      Export Current Layout
                    </button>

                    {/* Import Library (layouts) */}
                    <label style={LIB_BTN_STYLE} title="Import a saved library (JSON with layouts)">
                      Import Library From File
                      <input
                        type="file"
                        accept="application/json"
                        hidden
                        onChange={(e) => e.target.files && importLibraryLayouts(e.target.files[0])}
                      />
                    </label>

                    {/* Export Library (layouts) */}
                    <button
                      onClick={exportLibrary}
                      style={LIB_BTN_STYLE}
                      title="Export all saved layouts as JSON"
                    >
                      Export Library
                    </button>
                  </>
                ) : (
                  <>
                    {/* Upload .txt files */}
                    <label style={LIB_BTN_STYLE} title="Upload .txt file(s) into the current folder">
                      Upload .txt Files
                      <input
                        type="file"
                        accept=".txt,text/plain"
                        multiple
                        hidden
                        onChange={(e) => e.target.files && uploadTxtFiles(e.target.files, activeFolder)}
                      />
                    </label>

                    {/* New Folder */}
                    <button
                      onClick={createFolder}
                      style={LIB_BTN_STYLE}
                      title="Create a new folder"
                    >
                      New Folder
                    </button>

                    {/* Import Document Library */}
                    <label style={LIB_BTN_STYLE} title="Import a Document Library JSON (folders and files)">
                      Import Doc Library
                      <input
                        type="file"
                        accept="application/json"
                        hidden
                        onChange={(e) => e.target.files && importDocLibrary(e.target.files[0])}
                      />
                    </label>

                    {/* Export Document Library */}
                    <button
                      onClick={exportDocLibrary}
                      style={LIB_BTN_STYLE}
                      title="Export all folders and files as JSON"
                    >
                      Export Doc Library
                    </button>
                  </>
                )}
              </div>

              {/* Right cluster: toggle tab + Close */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {libraryTab === 'layouts' ? (
                  <button
                    onClick={() => setLibraryTab('docs')}
                    style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: BUTTON_FONT_SIZE }}
                    title="Open the Document Library"
                  >
                    📄 Document Library
                  </button>
                ) : (
                  <button
                    onClick={() => setLibraryTab('layouts')}
                    style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: BUTTON_FONT_SIZE }}
                    title="Back to Layouts Library"
                  >
                    📚 Layouts
                  </button>
                )}

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
            </div>

            {/* Content Area */}
            {libraryTab === 'layouts' ? (
              <>
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
              </>
            ) : (
              // ----------- Document Library UI -----------
              <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 12, minHeight: 300 }}>
                {/* Sidebar: Folders */}
                <div
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    padding: 10,
                    display: 'grid',
                    alignContent: 'start',
                    gap: 6
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Folders</div>

                  {/* Special filters */}
                  <button
                    onClick={() => setActiveFolder('all')}
                    style={{
                      textAlign: 'left',
                      background: activeFolder === 'all' ? ACCENT : PANEL,
                      color: activeFolder === 'all' ? '#fff' : TEXT,
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: `1px solid ${BORDER}`
                    }}
                  >
                    📁 All
                  </button>
                  <button
                    onClick={() => setActiveFolder('unfiled')}
                    style={{
                      textAlign: 'left',
                      background: activeFolder === 'unfiled' ? ACCENT : PANEL,
                      color: activeFolder === 'unfiled' ? '#fff' : TEXT,
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: `1px solid ${BORDER}`
                    }}
                  >
                    🗂 Unfiled
                  </button>

                  {/* User folders */}
                  <div style={{ height: 1, background: BORDER, margin: '6px 0' }} />
                  {docLib.folders.length === 0 && (
                    <div style={{ opacity: .7, fontSize: 12 }}>(No folders yet)</div>
                  )}
                  {docLib.folders.map(folder => (
                    <div
                      key={folder.id}
                      style={{
                        display: 'grid',
                        gap: 6,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        padding: 8,
                        background: activeFolder === folder.id ? 'rgba(0,0,0,0.04)' : 'transparent'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => setActiveFolder(folder.id)}
                          style={{
                            textAlign: 'left',
                            background: PANEL,
                            color: TEXT,
                            padding: '6px 8px',
                            borderRadius: 8,
                            border: `1px solid ${BORDER}`,
                            flex: 1
                          }}
                          title="Open folder"
                        >
                          📁 {folder.name}
                        </button>
                        <button
                          onClick={() => renameFolder(folder.id)}
                          style={{ background: PANEL, color: TEXT, padding: '6px 8px', borderRadius: 8, border: `1px solid ${BORDER}` }}
                          title="Rename folder"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteFolder(folder.id)}
                          style={{ background: PANEL, color: TEXT, padding: '6px 8px', borderRadius: 8, border: `1px solid ${BORDER}` }}
                          title="Delete folder"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Main: Files list */}
                <div
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    padding: 10,
                    display: 'grid',
                    alignContent: 'start',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700 }}>
                      {activeFolder === 'all' ? 'All Documents'
                        : activeFolder === 'unfiled' ? 'Unfiled Documents'
                        : `Folder: ${docLib.folders.find(f => f.id === activeFolder)?.name ?? ''}`}
                    </div>

                    {/* Quick upload into current context */}
                    <label style={{ ...LIB_BTN_STYLE, padding: '4px 8px' }} title="Upload .txt into this view">
                      Upload here
                      <input
                        type="file"
                        accept=".txt,text/plain"
                        multiple
                        hidden
                        onChange={(e) => e.target.files && uploadTxtFiles(e.target.files, activeFolder)}
                      />
                    </label>
                  </div>

                  {filteredFiles.length === 0 ? (
                    <div style={{ opacity: .7, fontSize: 14 }}>(No documents)</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {filteredFiles.map(file => (
                        <div
                          key={file.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: 8,
                            border: `1px solid ${BORDER}`,
                            borderRadius: 8,
                            padding: 8,
                            background: BG
                          }}
                        >
                          {/* Name + meta */}
                          <div>
                            <div style={{ fontWeight: 600 }}>{file.name}</div>
                            <div style={{ opacity: .6, fontSize: 12 }}>
                              Created: {fmt(file.createdAt)} &nbsp;•&nbsp; Updated: {fmt(file.updatedAt)}
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setPreviewDocId(file.id)}
                              style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8, border: `1px solid ${BORDER}` }}
                              title="Open / Preview"
                            >
                              Open
                            </button>

                            {/* Move selector */}
                            <select
                              value={file.folderId ?? 'unfiled'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'unfiled') moveFile(file.id, 'unfiled');
                                else moveFile(file.id, val);
                              }}
                              style={{
                                background: PANEL, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 8px'
                              }}
                              title="Move to folder"
                            >
                              <option value="unfiled">Unfiled</option>
                              {docLib.folders.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>

                            <button
                              onClick={() => renameFile(file.id)}
                              style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8, border: `1px solid ${BORDER}` }}
                              title="Rename file"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => deleteFile(file.id)}
                              style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8, border: `1px solid ${BORDER}` }}
                              title="Delete file"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* In-modal Preview for .txt files */}
          {previewDoc && (
            <div
              onClick={() => setPreviewDocId(null)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
                display: 'grid', placeItems: 'center', zIndex: 10001
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12,
                  width: 'min(720px, 92vw)', maxHeight: '70vh', overflow: 'auto', padding: 16, display: 'grid', gap: 10
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{previewDoc.name}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => {
                        copyNow(previewDoc.content);
                      }}
                      style={{ background: PANEL, color: TEXT, padding: '6px 10px', borderRadius: 8, border: `1px solid ${BORDER}` }}
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => setPreviewDocId(null)}
                      style={{ background: ACCENT, color: '#fff', padding: '6px 10px', borderRadius: 8 }}
                    >
                      Close
                    </button>
                  </div>
                </div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                    padding: 12,
                    color: TEXT,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                  }}
                >
{previewDoc.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
