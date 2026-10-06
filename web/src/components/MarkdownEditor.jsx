import { useEffect, useRef, useState } from 'react';
import { Markdown } from './Markdown';

// Dependency-free Markdown editor: a formatting toolbar that wraps/prefixes the
// selection in the raw source (the "code view"), plus a Write/Preview toggle that
// renders with the app's own Markdown component. No WYSIWYG, so the round-trip is
// always exactly the markdown you see.
export function MarkdownEditor({ value, onChange, repoCtx }) {
  const [mode, setMode] = useState('preview'); // 'preview' (formatted) | 'write' (code)
  const taRef = useRef(null);
  const pendingToolRef = useRef(null);

  // Formatting edits the source, so a tool clicked in Preview switches to Code
  // first; run the queued action once the textarea has mounted.
  useEffect(() => {
    if (mode === 'write' && pendingToolRef.current) {
      const fn = pendingToolRef.current;
      pendingToolRef.current = null;
      fn();
    }
  }, [mode]);

  function runTool(fn) {
    if (mode === 'preview') {
      pendingToolRef.current = fn;
      setMode('write');
    } else {
      fn();
    }
  }

  // Re-focus and restore a selection after a controlled value update lands.
  function restore(start, end) {
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.selectionStart = start;
      el.selectionEnd = end;
    });
  }

  // Wrap the current selection with `before`/`after` (bold, italic, code, link…).
  function wrap(before, after = before, placeholder = '') {
    const el = taRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || placeholder;
    onChange(value.slice(0, s) + before + sel + after + value.slice(e));
    restore(s + before.length, s + before.length + sel.length);
  }

  // Prefix every line in the selection (lists, quotes, headings).
  function linePrefix(prefix, { numbered = false } = {}) {
    const el = taRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const nl = value.indexOf('\n', e);
    const lineEnd = nl === -1 ? value.length : nl;
    const block = value.slice(lineStart, lineEnd);
    const out = block
      .split('\n')
      .map((ln, i) => (numbered ? `${i + 1}. ${ln}` : `${prefix}${ln}`))
      .join('\n');
    onChange(value.slice(0, lineStart) + out + value.slice(lineEnd));
    restore(lineStart, lineStart + out.length);
  }

  function insertLink() {
    const el = taRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const text = value.slice(s, e) || 'text';
    const head = `[${text}](`;
    const next = `${value.slice(0, s)}${head}url)${value.slice(e)}`;
    onChange(next);
    restore(s + head.length, s + head.length + 3); // select the "url" placeholder
  }

  function codeBlock() {
    const el = taRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || 'code';
    const block = `\`\`\`\n${sel}\n\`\`\``;
    onChange(value.slice(0, s) + block + value.slice(e));
    restore(s + 4, s + 4 + sel.length);
  }

  function onKeyDown(e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') {
      e.preventDefault();
      wrap('**', '**', 'bold');
    } else if (k === 'i') {
      e.preventDefault();
      wrap('*', '*', 'italic');
    }
  }

  const tools = [
    { label: 'B', title: 'Bold (⌘/Ctrl+B)', style: { fontWeight: 800 }, run: () => wrap('**', '**', 'bold') },
    { label: 'I', title: 'Italic (⌘/Ctrl+I)', style: { fontStyle: 'italic' }, run: () => wrap('*', '*', 'italic') },
    { label: 'H1', title: 'Heading 1', run: () => linePrefix('# ') },
    { label: 'H2', title: 'Heading 2', run: () => linePrefix('## ') },
    { label: '• List', title: 'Bulleted list', run: () => linePrefix('- ') },
    { label: '1. List', title: 'Numbered list', run: () => linePrefix('', { numbered: true }) },
    { label: '❝', title: 'Quote', run: () => linePrefix('> ') },
    { label: '`code`', title: 'Inline code', run: () => wrap('`', '`', 'code') },
    { label: '{ }', title: 'Code block', run: codeBlock },
    { label: 'Link', title: 'Link', run: insertLink },
  ];

  return (
    <div className="md-editor">
      <div className="md-editor-bar">
        <div className="md-editor-tabs">
          <button type="button" className={`md-tab ${mode === 'preview' ? 'active' : ''}`} onClick={() => setMode('preview')}>
            Preview
          </button>
          <button type="button" className={`md-tab ${mode === 'write' ? 'active' : ''}`} onClick={() => setMode('write')}>
            Code
          </button>
        </div>
        <div className="md-toolbar">
          {tools.map((t) => (
            <button key={t.title} type="button" className="md-tool" title={t.title} style={t.style} onMouseDown={(e) => e.preventDefault()} onClick={() => runTool(t.run)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'write' ? (
        <textarea
          ref={taRef}
          className="artifact-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
        />
      ) : (
        <div className="md-editor-preview">
          {value.trim() ? <Markdown repoCtx={repoCtx}>{value}</Markdown> : <div className="muted">Nothing to preview.</div>}
        </div>
      )}
    </div>
  );
}
