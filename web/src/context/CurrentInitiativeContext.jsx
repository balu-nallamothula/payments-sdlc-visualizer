import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// The initiative the user is currently working with. Set when an initiative
// detail page loads; read by the sidebar so its "Dev Plan" link points at the
// current initiative (/dev-plan?initiative=…) and follows a new selection.
// Persisted so it survives a reload; the raw key is also read as a fallback by
// the Dev Plan board.
const STORAGE_KEY = 'sdlc-current-initiative';
const Ctx = createContext(null);

function initialInitiative() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function CurrentInitiativeProvider({ children }) {
  const [current, setCurrentState] = useState(initialInitiative);

  const setCurrent = useCallback((name) => {
    setCurrentState(name || null);
    try {
      if (name) localStorage.setItem(STORAGE_KEY, name);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ current, setCurrent }), [current, setCurrent]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCurrentInitiative() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCurrentInitiative must be used within CurrentInitiativeProvider');
  return ctx;
}
