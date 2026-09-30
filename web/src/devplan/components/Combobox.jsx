import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Custom typeahead select, styled like the Sprint Planning combobox.
 * options: [{ value, label, hint? }]  ·  controlled via value / onChange(value).
 * The dropdown renders in a portal (fixed position) so it never gets clipped by
 * overflow containers (e.g. the scrollable team table).
 */
export default function Combobox({ options, value, onChange, placeholder = "Select…", ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(-1);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.value === value) || null;
  const selectedLabel = selected ? selected.label : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint || "").toLowerCase().includes(q));
  }, [options, query]);

  const place = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 4, width: r.width });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    const onDocDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      closeList();
    };
    document.addEventListener("mousedown", onDocDown);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("mousedown", onDocDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function openList() { setOpen(true); setQuery(""); setHi(-1); }
  function closeList() { setOpen(false); setQuery(""); setHi(-1); }
  function pick(opt) { if (!opt) return; onChange(opt.value); closeList(); inputRef.current?.blur(); }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) return openList(); setHi((h) => Math.min(filtered.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (open) setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { if (open && hi >= 0) { e.preventDefault(); pick(filtered[hi]); } }
    else if (e.key === "Escape") { if (open) { e.preventDefault(); closeList(); } }
    else if (e.key === "Tab") { closeList(); }
  }

  const list = open && pos
    ? createPortal(
        // Portaled to <body>, so wrap in .devplan-root to carry the board's
        // scoped styles + token remap outside the page subtree.
        <div className="devplan-root">
          <ul className="combobox-list" role="listbox" ref={listRef}
            style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, right: "auto", zIndex: 60 }}>
            {filtered.length === 0 && <li className="combobox-empty">No matches</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                className={"combobox-option" + (i === hi ? " is-highlighted" : "") + (o.value === value ? " is-selected" : "")}
                role="option" aria-selected={o.value === value}
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                onMouseEnter={() => setHi(i)}
              >
                <span className="combobox-option-label">{o.label}</span>
                {o.hint && <span className="combobox-option-hint">{o.hint}</span>}
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={"combobox-wrap" + (open ? " is-open" : "")} ref={wrapRef}>
      <input
        ref={inputRef}
        className="combobox-input"
        role="combobox" aria-expanded={open} aria-autocomplete="list" aria-label={ariaLabel}
        autoComplete="off"
        value={open ? query : selectedLabel}
        placeholder={open ? selectedLabel || placeholder : placeholder}
        onFocus={openList}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHi(e.target.value ? 0 : -1); }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => { if (document.activeElement !== inputRef.current) closeList(); }, 100)}
      />
      <span className="combobox-caret" aria-hidden="true">▾</span>
      {list}
    </div>
  );
}
