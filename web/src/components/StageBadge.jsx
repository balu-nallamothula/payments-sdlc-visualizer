import { STATUS_LABEL } from '../lib/stages';

const CLS = {
  done: 'ok',
  active: 'rose',
  pending: '',
  skipped: '',
  blocked: 'crit',
};

export function StageBadge({ status }) {
  return <span className={`badge ${CLS[status] || ''}`}>{STATUS_LABEL[status] || status}</span>;
}
