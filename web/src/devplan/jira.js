// Thin client for the host's read-only Jira proxy (server at /api/devplan/jira/*).

export async function jiraFetch(token, path) {
  if (!token) throw new Error("Paste your Personal Access Token in the Connect panel.");
  let res;
  try {
    res = await fetch(`/api/devplan/jira/${path}`, { headers: { "X-Jira-Token": token } });
  } catch {
    throw new Error("Couldn't reach the server. Make sure the SDLC Visualizer server is running.");
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status} calling Jira`);
  return data;
}

export function testConnection(token) {
  return jiraFetch(token, "myself");
}

// Returns { key, name, issues } for one epic.
export async function fetchEpic(token, key) {
  let name = key;
  try {
    const meta = await jiraFetch(token, `issue?key=${encodeURIComponent(key)}`);
    if (meta.summary) name = meta.summary;
  } catch {
    /* keep key as name */
  }
  const { issues } = await jiraFetch(token, `epic-issues?epic=${encodeURIComponent(key)}`);
  return { key, name, issues: issues || [] };
}
