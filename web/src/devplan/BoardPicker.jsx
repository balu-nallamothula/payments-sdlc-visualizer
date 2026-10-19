import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';

// Load the Dev Plan board by picking a Jira project + initiative instead of
// hand-typing epic IDs. Each initiative carries its distinct epicKeys (from the
// server), so selecting one resolves to its epics via the existing ?initiative=
// flow. The Jira project is just the key prefix (PAY / INV / EPS …).
const projectOf = (key) => String(key || '').split('-')[0].toUpperCase();

const selectStyle = {
  padding: '7px 10px',
  background: 'var(--panel-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  font: 'inherit',
  fontSize: 13,
  outline: 'none',
};

export function BoardPicker({ current, onPick }) {
  const [inits, setInits] = useState(null);
  const [project, setProject] = useState('');

  useEffect(() => {
    apiClient
      .initiatives()
      .then((r) => setInits(r.initiatives || []))
      .catch(() => setInits([]));
  }, []);

  const withEpics = useMemo(() => (inits || []).filter((i) => (i.epicKeys || []).length), [inits]);
  const projects = useMemo(
    // Exclude the local "EPIC-N" placeholder prefix — it isn't a real Jira project.
    () => [...new Set(withEpics.flatMap((i) => (i.epicKeys || []).map(projectOf)))].filter((p) => p !== 'EPIC').sort(),
    [withEpics],
  );
  const shown = useMemo(
    () => (project ? withEpics.filter((i) => (i.epicKeys || []).some((k) => projectOf(k) === project)) : withEpics),
    [withEpics, project],
  );

  if (!inits) return null;

  return (
    <div className="row wrap" style={{ gap: 10, alignItems: 'center', margin: '0 0 14px' }}>
      <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Load board by</span>
      <select value={project} onChange={(e) => setProject(e.target.value)} style={selectStyle} title="Filter by Jira project">
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select
        value={current || ''}
        onChange={(e) => e.target.value && onPick(e.target.value)}
        style={{ ...selectStyle, minWidth: 260 }}
        title="Pick an initiative to load its epics"
      >
        <option value="">Select an initiative…</option>
        {shown.map((i) => {
          const n = (i.epicKeys || []).length;
          return (
            <option key={i.id} value={i.id}>
              {i.initiativeName} ({n} epic{n === 1 ? '' : 's'})
            </option>
          );
        })}
      </select>
      {shown.length === 0 && (
        <span className="muted" style={{ fontSize: 12 }}>No initiatives with epics{project ? ` in ${project}` : ''}.</span>
      )}
    </div>
  );
}
