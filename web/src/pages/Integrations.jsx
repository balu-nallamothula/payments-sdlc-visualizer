import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { IconChat, IconDoc, IconPlug, IconStages } from '../components/icons';

export function IntegrationsPage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient.health().then(setHealth).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card">Failed to load: {error}</div>;
  if (!health) return <div className="spinner">Loading integrations…</div>;

  const c = health.config;
  const cards = [
    {
      icon: IconDoc,
      name: 'sephora-project-docs',
      desc: 'Layer-2 SDLC state (metadata.json + artifacts).',
      value: c.projectDocs,
      ok: c.projectDocsExists,
    },
    {
      icon: IconStages,
      name: 'seph-sdlc-coach',
      desc: 'Per-stage coaching cards rendered in the stage drawer.',
      value: c.coachStagesDir,
      ok: c.coachStagesDirExists,
    },
    {
      icon: IconChat,
      name: '/seph-sdlc engine',
      desc: `Chat gateway backend: ${c.chatBackend}. Drives the real pipeline.`,
      value: `CHAT_BACKEND=${c.chatBackend}`,
      ok: true,
    },
    {
      icon: IconPlug,
      name: 'workspace root',
      desc: 'Where target repos are cloned for the pipeline.',
      value: c.workspaceRoot,
      ok: true,
    },
  ];

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 4 }}>Integrations</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        Local connections this app reads from and drives. All paths are configurable via <span className="mono">.env</span>.
      </p>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="card" key={card.name}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="row" style={{ gap: 12 }}>
                  <span className="ficon" style={{ width: 38, height: 38 }}>
                    <Icon width={20} height={20} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{card.name}</div>
                    <div className="muted" style={{ fontSize: 12, maxWidth: 260 }}>{card.desc}</div>
                  </div>
                </div>
                <span className={`badge ${card.ok ? 'ok' : 'crit'}`}>{card.ok ? 'Connected' : 'Missing'}</span>
              </div>
              <div className="mono muted" style={{ fontSize: 11, marginTop: 12, wordBreak: 'break-all' }}>{card.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
