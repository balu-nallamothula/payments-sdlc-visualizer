import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { InitiativeCard } from '../components/InitiativeCard';

export function InitiativesPage() {
  const [initiatives, setInitiatives] = useState(null);
  const [error, setError] = useState(null);
  const [params] = useSearchParams();
  const q = (params.get('q') || '').toLowerCase();

  useEffect(() => {
    apiClient
      .initiatives()
      .then((r) => setInitiatives(r.initiatives))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card">Failed to load initiatives: {error}</div>;
  if (!initiatives) return <div className="spinner">Loading initiatives…</div>;

  const filtered = q
    ? initiatives.filter(
        (i) => i.initiativeName.toLowerCase().includes(q) || i.relPath.toLowerCase().includes(q),
      )
    : initiatives;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 className="page-title">Initiatives</h1>
        <span className="muted">
          {filtered.length}
          {q ? ` of ${initiatives.length}` : ''} initiative{filtered.length === 1 ? '' : 's'}
          {q && <> matching “{q}”</>}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card muted">No initiatives match your search.</div>
      ) : (
        <div className="grid cards">
          {filtered.map((init) => (
            <InitiativeCard key={init.id} init={init} />
          ))}
        </div>
      )}
    </div>
  );
}
