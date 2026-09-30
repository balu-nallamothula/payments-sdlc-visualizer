import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { StageDrawer } from '../components/StageDrawer';

export function StagesPage() {
  const [stages, setStages] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    apiClient.stages().then((r) => setStages(r.stages)).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card">Failed to load stages: {error}</div>;
  if (!stages) return <div className="spinner">Loading stages…</div>;

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 4 }}>The 12-Stage Agentic SDLC</h1>
      <p className="muted" style={{ maxWidth: 720, marginTop: 4 }}>
        Stages 1–4 run once per <strong>initiative</strong>; stages 5–12 run once per <strong>Jira</strong>. Click any
        stage to read its coaching card — what the agent does, why it matters, and what to check at the review gate.
      </p>

      <div className="grid cards" style={{ marginTop: 18 }}>
        {stages.map((s) => (
          <div key={s.n} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(s.n)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="mono muted">Stage {String(s.n).padStart(2, '0')}</span>
              <span className={`badge ${s.phase === 'per-jira' ? 'rose' : 'violet'}`}>{s.phase}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, margin: '10px 0 4px' }}>{s.name}</div>
            <div className="mono muted" style={{ fontSize: 11 }}>{s.agent}</div>
            {s.card?.time && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>⏱ {s.card.time}</div>}
            {!s.hasCard && <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>coaching card not installed</div>}
          </div>
        ))}
      </div>

      {selected != null && (
        <StageDrawer
          n={selected}
          name={stages.find((s) => s.n === selected)?.name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
