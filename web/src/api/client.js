import { apiPath } from '../lib/basePath';

async function get(url) {
  const res = await fetch(apiPath(url));
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
  devplanConfig: () => get('/api/devplan/config'),
  initiatives: () => get('/api/initiatives'),
  initiative: (id, raw = false) =>
    get(`/api/initiatives/${encodeURIComponent(id)}${raw ? '?raw=1' : ''}`),
  jira: (initiativeId, jiraId, raw = false) =>
    get(
      `/api/initiatives/${encodeURIComponent(initiativeId)}/jiras/${encodeURIComponent(jiraId)}${
        raw ? '?raw=1' : ''
      }`,
    ),
  systems: () => get('/api/systems'),
  system: (repo, quarter) =>
    get(`/api/systems/${encodeURIComponent(repo)}${quarter ? `?quarter=${encodeURIComponent(quarter)}` : ''}`),
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
    const res = await fetch(apiPath('/api/artifact'), {
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
  gitBranches: () => get('/api/git/branches'),
  gitCheckout: async (branch, { force = false } = {}) => {
    const res = await fetch(apiPath('/api/git/checkout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, force }),
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.error) msg = body.error;
      } catch {
        /* ignore */
      }
      const err = new Error(msg);
      err.status = res.status; // 409 = blocked by uncommitted changes
      throw err;
    }
    return res.json();
  },
  suggestCommitMessage: async () => {
    const res = await fetch(apiPath('/api/git/suggest-message'), { method: 'POST' });
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
    const res = await fetch(apiPath('/api/git/commit'), {
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
