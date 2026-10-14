import { Link } from 'react-router-dom';
import { PipelineStrip } from './PipelineStrip';
import { summaryCells } from '../lib/stages';
import { initiativePath } from '../lib/paths';

export function InitiativeCard({ init }) {
  return (
    <Link to={initiativePath(init.id)} className="card" style={{ color: 'inherit', display: 'block' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{init.initiativeName}</div>
          <div className="muted mono" style={{ fontSize: 11 }}>{init.relPath}</div>
        </div>
        <span className={`badge ${init.phase === 'per-jira' ? 'rose' : 'violet'}`}>
          {init.phase === 'per-jira' ? 'per-jira' : 'initiative'}
        </span>
      </div>

      <div style={{ margin: '16px 0 10px' }}>
        <PipelineStrip cells={summaryCells(init)} />
      </div>

      <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
        <span className="muted">
          Stage <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{init.currentStageN ?? '—'}</span> / 12
        </span>
        <span className="muted">{init.jiraCount} jira{init.jiraCount === 1 ? '' : 's'}</span>
        {init.blockingCount > 0 ? (
          <span className="badge crit">{init.blockingCount} blocking</span>
        ) : (
          <span className="badge ok">{init.percent}%</span>
        )}
      </div>
    </Link>
  );
}
