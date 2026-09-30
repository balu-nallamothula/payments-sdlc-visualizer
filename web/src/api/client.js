async function get(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export const apiClient = {
  health: () => get('/api/health'),
  initiatives: () => get('/api/initiatives'),
  initiative: (id, raw = false) =>
    get(`/api/initiatives/${encodeURIComponent(id)}${raw ? '?raw=1' : ''}`),
  jira: (initiativeId, jiraId, raw = false) =>
    get(
      `/api/initiatives/${encodeURIComponent(initiativeId)}/jiras/${encodeURIComponent(jiraId)}${
        raw ? '?raw=1' : ''
      }`,
    ),
  stages: () => get('/api/stages'),
  stage: (n) => get(`/api/stages/${n}`),
  reference: (doc) => get(`/api/reference/${doc}`),
  artifacts: (initiative, jira) =>
    get(
      `/api/artifacts?initiative=${encodeURIComponent(initiative)}${
        jira ? `&jira=${encodeURIComponent(jira)}` : ''
      }`,
    ),
  artifact: (path) => get(`/api/artifact?path=${encodeURIComponent(path)}`),
  saveArtifact: async (path, content) => {
    const res = await fetch('/api/artifact', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.error) msg = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return res.json();
  },
  gitStatus: () => get('/api/git/status'),
  suggestCommitMessage: async () => {
    const res = await fetch('/api/git/suggest-message', { method: 'POST' });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.error) msg = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return res.json();
  },
  gitCommit: async (message, paths) => {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, paths }),
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.error) msg = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return res.json();
  },
};
