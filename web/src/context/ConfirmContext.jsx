import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// App-wide confirm dialog: an in-app, themed replacement for window.confirm.
// Usage:  const confirm = useConfirm();
//         if (await confirm({ title, message, confirmLabel, danger })) { … }
// Resolves true on confirm, false on cancel / backdrop / Escape.
const Ctx = createContext(null);

const DEFAULTS = { title: 'Are you sure?', message: '', confirmLabel: 'OK', cancelLabel: 'Cancel', danger: false };

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { ...opts } | null
  const resolver = useRef(null);
  const confirmBtn = useRef(null);

  const settle = useCallback((result) => {
    const fn = resolver.current;
    resolver.current = null;
    setState(null);
    if (fn) fn(result);
  }, []);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({ ...DEFAULTS, ...opts });
    });
  }, []);

  // Escape cancels; focus the confirm button when the dialog opens.
  useEffect(() => {
    if (!state) return undefined;
    confirmBtn.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') settle(false);
      else if (e.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, settle]);

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="confirm-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) settle(false); }}
        >
          <div className="confirm-card card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <h3 id="confirm-title" className="confirm-title">{state.title}</h3>
            {state.message && <p className="confirm-message">{state.message}</p>}
            <div className="confirm-actions">
              <button type="button" className="btn" onClick={() => settle(false)}>
                {state.cancelLabel}
              </button>
              <button
                ref={confirmBtn}
                type="button"
                className={`btn primary${state.danger ? ' danger' : ''}`}
                onClick={() => settle(true)}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
