import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { InitiativeCard } from '../components/InitiativeCard';
import { IconArrowRight } from '../components/icons';

export function DashboardPage() {
  const [initiatives, setInitiatives] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .initiatives()
      .then((r) => setInitiatives(r.initiatives))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card">Failed to load: {error}</div>;
  if (!initiatives) return <div className="spinner">Loading dashboard…</div>;

  const recent = initiatives.slice(0, 6);

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 4 }}>Dashboard</h1>
      <div className="page-sub" style={{ fontFamily: 'inherit', marginBottom: 20 }}>
        Sephora Agentic SDLC — live pipeline state across all initiatives.
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Recent initiatives</h2>
        <Link to="/initiatives" className="btn sm ghost">
          View all <IconArrowRight width={14} height={14} />
        </Link>
      </div>
      <div className="grid cards">
        {recent.map((init) => (
          <InitiativeCard key={init.id} init={init} />
        ))}
      </div>
    </div>
  );
}
