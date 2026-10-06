import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from './Markdown';

// ---------------------------------------------------------------------------
// DOM -> Markdown serialization (best-effort) for the editable Preview.
// The preview is a contenteditable rendered from the markdown; on edit we read
// its DOM back into markdown. Covers the common GFM elements react-markdown
// produces; exotic constructs may normalize.
// ---------------------------------------------------------------------------
function serializeInline(node) {
  let out = '';
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      out += n.textContent;
    } else if (n.nodeType === 1) {
      const tag = n.tagName.toLowerCase();
      if (tag === 'br') { out += '  \n'; return; }
      if (tag === 'code') { out += `\`${n.textContent}\``; return; }
      if (tag === 'strong' || tag === 'b') { out += `**${serializeInline(n)}**`; return; }
      if (tag === 'em' || tag === 'i') { out += `*${serializeInline(n)}*`; return; }
      if (tag === 'del' || tag === 's') { out += `~~${serializeInline(n)}~~`; return; }
      if (tag === 'a') { out += `[${serializeInline(n)}](${n.getAttribute('href') || ''})`; return; }
      if (tag === 'input') return; // task-list checkbox handled by the <li>
      out += serializeInline(n);
    }
  });
  return out;
}

function serializeList(listEl, ordered, depth) {
  const lines = [];
  let i = 1;
  listEl.querySelectorAll(':scope > li').forEach((li) => {
    const checkbox = li.querySelector(':scope > input[type="checkbox"]');
    const task = checkbox ? (checkbox.checked ? '[x] ' : '[ ] ') : '';
    const marker = ordered ? `${i}. ` : '- ';
    let inline = '';
    const nested = [];
    li.childNodes.forEach((c) => {
      if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) {
        nested.push(serializeList(c, c.tagName === 'OL', depth + 1));
      } else if (c.nodeType === 1 && c.tagName === 'P') {
        inline += serializeInline(c);
      } else if (c.nodeType === 3) {
        inline += c.textContent;
      } else if (c.nodeType === 1 && c.tagName !== 'INPUT') {
        inline += serializeInline(c);
      }
    });
    const indent = '  '.repeat(depth);
    lines.push(`${indent}${marker}${task}${inline.trim()}`);
    nested.forEach((n) => lines.push(n));
    i += 1;
  });
  return lines.join('\n');
}

function serializeTable(table) {
  const rows = [...table.querySelectorAll('tr')];
  const lines = [];
  rows.forEach((tr, idx) => {
    const cells = [...tr.children].map((c) => serializeInline(c).trim().replace(/\|/g, '\\|'));
    lines.push(`| ${cells.join(' | ')} |`);
    if (idx === 0) lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
  });
  return lines.join('\n');
}

function serializeBlocks(container) {
  const parts = [];
  container.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      const t = n.textContent.trim();
      if (t) parts.push(t);
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      parts.push(`${'#'.repeat(Number(tag[1]))} ${serializeInline(n)}`);
    } else if (tag === 'p') {
      parts.push(serializeInline(n));
    } else if (tag === 'ul') {
      parts.push(serializeList(n, false, 0));
    } else if (tag === 'ol') {
      parts.push(serializeList(n, true, 0));
    } else if (tag === 'blockquote') {
      parts.push(serializeBlocks(n).split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n'));
    } else if (tag === 'pre') {
      const code = n.querySelector('code');
      const cls = code?.getAttribute('class') || '';
      const lang = (cls.match(/language-(\S+)/) || [, ''])[1];
      parts.push(`\`\`\`${lang}\n${(code ? code.textContent : n.textContent).replace(/\n$/, '')}\n\`\`\``);
    } else if (tag === 'hr') {
      parts.push('---');
    } else if (tag === 'table') {
      parts.push(serializeTable(n));
    } else if (tag === 'br') {
      // ignore stray block-level <br>
    } else {
      const inner = serializeBlocks(n);
      if (inner) parts.push(inner);
    }
  });
  return parts.join('\n\n');
}

function domToMarkdown(root) {
  return `${serializeBlocks(root).replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

// Dependency-free Markdown editor: edit in the formatted Preview (a
// contenteditable rendered from the markdown) or in the raw Code textarea; a
// toolbar applies common formatting. Markdown in, markdown out.
export function MarkdownEditor({ value, onChange, repoCtx }) {
  const [mode, setMode] = useState('preview'); // 'preview' (formatted) | 'write' (code)
  const taRef = useRef(null);
  const previewRef = useRef(null);
  const pendingToolRef = useRef(null);
  const lastEmittedRef = useRef(null); // markdown we emitted from a preview edit (echo guard)

  // Fill the editable preview when the markdown changes from outside (doc switch,
  // Code edit, mode switch) — but not on the user's own typing, which would reset
  // the caret. Rendered without repoCtx so link hrefs round-trip unchanged.
  useEffect(() => {
    if (mode !== 'preview') return;
    const el = previewRef.current;
    if (!el) return;
    // Skip re-rendering (which would reset the caret) only when this value is our
    // own just-typed edit AND the DOM already shows it. On a fresh mount (empty
    // div, e.g. after toggling back from Code) always render.
    if (value === lastEmittedRef.current && el.innerHTML.trim() !== '') return;
    el.innerHTML = renderToStaticMarkup(<Markdown>{value}</Markdown>);
  }, [mode, value]);

  function onPreviewInput() {
    const el = previewRef.current;
    if (!el) return;
    const md = domToMarkdown(el);
    lastEmittedRef.current = md;
    onChange(md);
  }

  // ---- Code-mode (textarea) formatting helpers ----
  function restore(start, end) {
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.selectionStart = start;
      el.selectionEnd = end;
    });
  }
  function wrap(before, after = before, placeholder = '') {
    const el = taRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || placeholder;
    onChange(value.slice(0, s) + before + sel + after + value.slice(e));
    restore(s + before.length, s + before.length + sel.length);
  }
  function linePrefix(prefix, { numbered = false } = {}) {
    const el = taRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const nl = value.indexOf('\n', e);
    const lineEnd = nl === -1 ? value.length : nl;
    const out = value
      .slice(lineStart, lineEnd)
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
    onChange(`${value.slice(0, s)}${head}url)${value.slice(e)}`);
    restore(s + head.length, s + head.length + 3);
  }
  function codeBlock() {
    const el = taRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || 'code';
    onChange(`${value.slice(0, s)}\`\`\`\n${sel}\n\`\`\`${value.slice(e)}`);
    restore(s + 4, s + 4 + sel.length);
  }
  function onKeyDown(e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); wrap('**', '**', 'bold'); }
    else if (k === 'i') { e.preventDefault(); wrap('*', '*', 'italic'); }
  }

  // Formatting edits the source; a tool clicked in Preview switches to Code and
  // runs once the textarea mounts.
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
        <div
          ref={previewRef}
          className="md-editor-preview md-editable"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onInput={onPreviewInput}
        />
      )}
    </div>
  );
}
