import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Shared modal shell: portals to <body>, closes on backdrop click / Escape,
// carries the ARIA dialog semantics, and traps focus inside the dialog. Owners
// supply the title (+ optional count badge) and pass the body/footer as
// children (typically a `.modal-body` and a `.modal-foot`).
export default function Modal({ title, count, ariaLabel, onClose, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Move focus into the dialog on open and keep Tab within it.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    node.focus();
    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const els = node.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, []);

  // Portaled to <body>, so wrap in .devplan-root to carry the board's scoped
  // styles + token remap outside the page subtree.
  return createPortal(
    <div className="devplan-root">
      <div className="modal-backdrop" onMouseDown={onClose}>
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          tabIndex={-1}
          ref={dialogRef}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="modal-head">
            <h2>{title}{count != null && <span className="count-badge">{count}</span>}</h2>
            <button className="modal-x" type="button" title="Close" onClick={onClose}>×</button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
