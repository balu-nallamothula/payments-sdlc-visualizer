import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from './Markdown';

// ---------------------------------------------------------------------------
// DOM -> Markdown serialization (best-effort) for the editable Preview.
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
    lines.push(`${'  '.repeat(depth)}${marker}${task}${inline.trim()}`);
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
    } else if (tag === 'p' || tag === 'div') {
      const inner = tag === 'div' && n.querySelector('ul,ol,pre,table,blockquote,h1,h2,h3,h4,h5,h6')
        ? serializeBlocks(n)
        : serializeInline(n);
      if (inner.trim()) parts.push(inner);
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
    } else if (tag !== 'br') {
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
// contenteditable with live markdown shortcuts + an in-place toolbar) or in the
// raw Code textarea. Markdown in, markdown out.
export function MarkdownEditor({ value, onChange }) {
  const [mode, setMode] = useState('preview'); // 'preview' (formatted) | 'write' (code)
  const taRef = useRef(null);
  const previewRef = useRef(null);
  const lastEmittedRef = useRef(null);

  // Fill the editable preview when markdown changes from outside (doc switch, Code
  // edit, mode switch) — not on the user's own typing (which would reset the caret).
  useEffect(() => {
    if (mode !== 'preview') return;
    const el = previewRef.current;
    if (!el) return;
    if (value === lastEmittedRef.current && el.innerHTML.trim() !== '') return;
    el.innerHTML = renderToStaticMarkup(<Markdown>{value}</Markdown>);
  }, [mode, value]);

  function emitFromPreview() {
    const el = previewRef.current;
    if (!el) return;
    const md = domToMarkdown(el);
    lastEmittedRef.current = md;
    onChange(md);
  }

  // Live markdown shortcuts: transform a completed pattern at the caret as you type.
  function applyInputRules() {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed || !sel.rangeCount) return;
      const node = sel.focusNode;
      if (!node || node.nodeType !== 3) return;
      const offset = sel.focusOffset;
      const text = node.textContent;
      const before = text.slice(0, offset);

      // Block rule: "# " / "- " / "1. " / "> " at the start of the block.
      const blockM = before.match(/^(#{1,6}|[-*]|\d+\.|>) $/);
      if (blockM && !node.previousSibling) {
        const marker = blockM[1];
        node.textContent = text.slice(offset);
        const r = document.createRange();
        r.setStart(node, 0); r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
        if (marker[0] === '#') document.execCommand('formatBlock', false, `<h${marker.length}>`);
        else if (marker === '-' || marker === '*') document.execCommand('insertUnorderedList');
        else if (/\d+\./.test(marker)) document.execCommand('insertOrderedList');
        else if (marker === '>') document.execCommand('formatBlock', false, '<blockquote>');
        return;
      }

      // Inline rules: **bold**, `code`, *italic* ending at the caret.
      const inline = [
        { re: /\*\*([^*\n]+)\*\*$/, tag: 'strong', grp: 1, lead: 0 },
        { re: /`([^`\n]+)`$/, tag: 'code', grp: 1, lead: 0 },
        { re: /(^|[^*])\*([^*\n]+)\*$/, tag: 'em', grp: 2, lead: 1 },
      ];
      for (const rule of inline) {
        const m = before.match(rule.re);
        if (!m) continue;
        const inner = m[rule.grp];
        const lead = rule.lead ? m[1].length : 0;
        const matchStart = offset - m[0].length + lead;
        const parent = node.parentNode;
        const frag = document.createDocumentFragment();
        const keep = text.slice(0, matchStart);
        if (keep) frag.appendChild(document.createTextNode(keep));
        const el = document.createElement(rule.tag);
        el.textContent = inner;
        frag.appendChild(el);
        const afterNode = document.createTextNode(text.slice(offset));
        frag.appendChild(afterNode);
        parent.replaceChild(frag, node);
        const r = document.createRange();
        r.setStart(afterNode, 0); r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
        return;
      }
    } catch {
      /* best-effort: never break typing */
    }
  }

  function onPreviewInput() {
    applyInputRules();
    emitFromPreview();
  }

  // ---- In-place Preview formatting (toolbar) ----
  function pvExec(cmd, arg) {
    document.execCommand(cmd, false, arg);
    emitFromPreview();
  }
  function pvWrapInline(tag, placeholder) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const el = document.createElement(tag);
    el.textContent = range.toString() || placeholder;
    range.deleteContents();
    range.insertNode(el);
    const r = document.createRange();
    r.setStartAfter(el); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
    emitFromPreview();
  }
  function pvCodeBlock() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = range.toString() || 'code';
    pre.appendChild(code);
    range.deleteContents();
    range.insertNode(pre);
    emitFromPreview();
  }
  function pvLink() {
    const url = window.prompt('Link URL:', 'https://');
    if (url == null) return;
    document.execCommand('createLink', false, url || '#');
    emitFromPreview();
  }

  // ---- Code-mode (textarea) formatting ----
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
  function codeBlockCode() {
    const el = taRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || 'code';
    onChange(`${value.slice(0, s)}\`\`\`\n${sel}\n\`\`\`${value.slice(e)}`);
    restore(s + 4, s + 4 + sel.length);
  }
  function onCodeKeyDown(e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); wrap('**', '**', 'bold'); }
    else if (k === 'i') { e.preventDefault(); wrap('*', '*', 'italic'); }
  }

  // Each tool knows how to apply itself in Code (textarea) and in Preview (DOM).
  const tools = [
    { label: 'B', title: 'Bold (⌘/Ctrl+B)', style: { fontWeight: 800 }, code: () => wrap('**', '**', 'bold'), pv: () => pvExec('bold') },
    { label: 'I', title: 'Italic (⌘/Ctrl+I)', style: { fontStyle: 'italic' }, code: () => wrap('*', '*', 'italic'), pv: () => pvExec('italic') },
    { label: 'H1', title: 'Heading 1', code: () => linePrefix('# '), pv: () => pvExec('formatBlock', '<h1>') },
    { label: 'H2', title: 'Heading 2', code: () => linePrefix('## '), pv: () => pvExec('formatBlock', '<h2>') },
    { label: '• List', title: 'Bulleted list', code: () => linePrefix('- '), pv: () => pvExec('insertUnorderedList') },
    { label: '1. List', title: 'Numbered list', code: () => linePrefix('', { numbered: true }), pv: () => pvExec('insertOrderedList') },
    { label: '❝', title: 'Quote', code: () => linePrefix('> '), pv: () => pvExec('formatBlock', '<blockquote>') },
    { label: '`code`', title: 'Inline code', code: () => wrap('`', '`', 'code'), pv: () => pvWrapInline('code', 'code') },
    { label: '{ }', title: 'Code block', code: codeBlockCode, pv: pvCodeBlock },
    { label: 'Link', title: 'Link', code: insertLink, pv: pvLink },
  ];
  const runTool = (t) => (mode === 'write' ? t.code() : t.pv());

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
            <button key={t.title} type="button" className="md-tool" title={t.title} style={t.style} onMouseDown={(e) => e.preventDefault()} onClick={() => runTool(t)}>
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
          onKeyDown={onCodeKeyDown}
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
