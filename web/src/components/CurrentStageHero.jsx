import { STAGE_FOCUS, STATUS_LABEL } from '../lib/stages';
import { IconCheck, IconPlay, IconTarget } from './icons';

/** The "Current Stage" hero card for an initiative or jira. The icon tile runs
 *  the current stage in chat when `onAction` is provided. */
export function CurrentStageHero({ cells, currentStageN, owner, onAction }) {
  const total = cells.length ? Math.max(...cells.map((c) => c.n)) : 12;
  const stageCount = cells.length;
  const doneCount = cells.filter((c) => c.status === 'done' || c.status === 'skipped').length;
  // Prefer the stage the pipeline is actually working on: the active cell, then
  // the first not-yet-done cell, then the metadata pointer as a last resort.
  const current =
    cells.find((c) => c.status === 'active') ||
    cells.find((c) => c.status === 'blocked') ||
    cells.find((c) => c.status !== 'done' && c.status !== 'skipped') ||
    cells.find((c) => c.n === currentStageN);

  if (!current) {
    return (
      <div className="hero">
        <div className="icon">
          <IconCheck width={30} height={30} />
        </div>
        <div>
          <div className="label">Pipeline complete</div>
          <div className="title">All stages done</div>
          <div className="sub">Every stage has finished for this item.</div>
        </div>
        <div />
      </div>
    );
  }

  const agg = current.aggregate && current.aggregate.total > 0 ? ` · ${current.aggregate.done}/${current.aggregate.total}` : '';

  return (
    <div className="hero">
      {onAction ? (
        <button className="icon" onClick={onAction} title="Run this stage in chat" style={{ border: 'none', padding: 0, cursor: 'pointer' }}>
          <IconPlay width={30} height={30} className="nudge" />
        </button>
      ) : (
        <div className="icon">
          <IconPlay width={30} height={30} />
        </div>
      )}
      <div>
        <div className="label">Current Stage</div>
        <div className="title">
          {current.name}{' '}
          <span className={`badge ${current.status === 'active' ? 'rose' : current.status === 'done' ? 'ok' : ''}`} style={{ verticalAlign: 'middle' }}>
            {STATUS_LABEL[current.status] || current.status}
          </span>
        </div>
        <div className="sub">
          Stage {String(current.n).padStart(2, '0')} of {total}
          {agg}
        </div>
      </div>
      <div className="focus">
        <span className="fi">
          <IconTarget width={20} height={20} />
        </span>
        <div>
          <div className="label" style={{ color: 'var(--accent)' }}>Focus</div>
          <div className="sub" style={{ maxWidth: 320 }}>{STAGE_FOCUS[current.n]}</div>
        </div>
      </div>
      <div className="meta">
        <div className="col">
          <div className="k">Stages done</div>
          <div className="v">
            {doneCount} / {stageCount}
          </div>
        </div>
        <div className="col">
          <div className="k">Remaining</div>
          <div className="v">{stageCount - doneCount}</div>
        </div>
        {owner && (
          <div className="col">
            <div className="k">Owner</div>
            <div className="v">{owner}</div>
          </div>
        )}
      </div>
    </div>
  );
}
