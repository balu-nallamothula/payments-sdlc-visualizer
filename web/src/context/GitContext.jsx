import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';

const Ctx = createContext(null);

/** Tracks uncommitted changes in sephora-project-docs so file cards can mark
 *  modified artifacts and the top bar can show a count. Polls periodically. */
export function GitProvider({ children }) {
  const [status, setStatus] = useState({ branch: null, files: [] });

  const refresh = useCallback(() => {
    apiClient.gitStatus().then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const changed = useMemo(() => new Set((status.files || []).map((f) => f.path)), [status]);

  const value = useMemo(
    () => ({ branch: status.branch, files: status.files || [], changed, count: (status.files || []).length, refresh }),
    [status, changed, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGit() {
  return (
    useContext(Ctx) || { branch: null, files: [], changed: new Set(), count: 0, refresh: () => {} }
  );
}
