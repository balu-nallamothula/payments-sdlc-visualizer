import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSSE } from '../hooks/useSSE';
import { consumePendingCreate } from '../lib/pendingCreate';
import { initiativePath } from '../lib/paths';

// A top-level metadata.json appearing = a new initiative became real.
// (Flat <year>/<slug>/metadata.json only — not nested jira metadata.)
const NEW_INITIATIVE_RE = /^\d{4}\/([^/]+)\/metadata\.json$/;

/**
 * Watches the docs repo (via SSE) and, when a `/seph-sdlc create` is in flight,
 * navigates to the new initiative the instant its metadata.json is written — so
 * starting an initiative in the chat lands you on its page automatically. Mounted
 * once at the app shell so it works regardless of the current route.
 */
export function InitiativeCreateWatcher() {
  const navigate = useNavigate();

  const onChange = useCallback(
    (change) => {
      if (!change || change.type !== 'add') return; // only a brand-new file
      const m = NEW_INITIATIVE_RE.exec(change.path || '');
      if (!m) return;
      if (!consumePendingCreate()) return; // only when we kicked off a create
      navigate(initiativePath(m[1]));
    },
    [navigate],
  );

  useSSE(true, onChange);
  return null;
}
