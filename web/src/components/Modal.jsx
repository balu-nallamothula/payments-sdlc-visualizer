import { useEffect } from 'react';

/** Centered modal dialog with a backdrop. Backdrop click or Esc closes it. */
export function Modal({ title, subtitle, actions, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header>
          <div style={{ minWidth: 0 }}>
            <h3>{title}</h3>
            {subtitle && <div className="muted" style={{ fontSize: 12 }}>{subtitle}</div>}
          </div>
          {actions && <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>{actions}</div>}
          <button className="close" onClick={onClose} aria-label="Close" style={actions ? { marginLeft: 8 } : undefined}>
            ×
          </button>
        </header>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}
