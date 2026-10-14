import { useParams } from 'react-router-dom';
import { InitiativeDetailPage } from './InitiativeDetail';
import { JiraDetailPage } from './JiraDetail';
import { parseInitiativeSplat } from '../lib/paths';

// Dispatcher for /initiatives/* — the initiative name can span multiple path
// segments (e.g. "payments/paze-discover"), with an optional trailing
// "/jiras/<id>" selecting a Jira. A splat route is the only way react-router v6
// can capture a variable-depth name, so we parse it here and hand off.
export function InitiativeRoute() {
  const { name, jiraId } = parseInitiativeSplat(useParams()['*']);
  if (!name) return <div className="card">Initiative not found</div>;
  return jiraId ? (
    <JiraDetailPage name={name} jiraId={jiraId} />
  ) : (
    <InitiativeDetailPage name={name} />
  );
}
