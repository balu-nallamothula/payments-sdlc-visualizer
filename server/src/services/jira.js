// Read-only Jira proxy for the Dev Plan board.
//
// Why this exists: browsers cannot call the internal Jira Server
// (jira.sephora.com) directly (CORS + credential exposure). These helpers forward
// GET requests to Jira, attaching each user's own Personal Access Token (passed
// per-request from the route in the X-Jira-Token header). The token is NEVER
// stored on the server.
//
// Ported from the standalone Dev Plan proxy (Documents/Codex/Dev Plan/server.js)
// and adapted to the visualizer's service conventions: ESM named async functions,
// config from ../config.js, global fetch, errors thrown with a .status the route
// maps to an HTTP response. The security posture (issue-key validation, 429/5xx
// retry, Bearer forwarding) is preserved exactly.

import { config, loadDevplanConfig } from '../config.js';

const jiraCfg = loadDevplanConfig().jira || {};
const JIRA_BASE = config.jiraBase;
const SP_FIELD = jiraCfg.storyPointsField || 'customfield_10173';
const SPRINT_FIELD = jiraCfg.sprintField || 'customfield_10510';
const EPIC_LINK_JQL = jiraCfg.epicLinkJql || '"Epic Link"';
const SPRINT_NUMBER_RE = new RegExp(jiraCfg.sprintNumberPattern || '\\b20\\d\\d\\.(\\d+)');

// Jira issue-key shape (e.g. PAY-6883). Validate any user-supplied key/epic
// before it reaches a URL path segment or JQL, so it can't smuggle in JQL
// operators or extra clauses.
export const ISSUE_KEY_RE = /^[A-Za-z][A-Za-z0-9]+-\d+$/;
export function isValidIssueKey(key) {
  return ISSUE_KEY_RE.test(key);
}

const ISSUE_FIELDS = [
  'summary',
  'issuetype',
  'assignee',
  'components',
  'labels',
  'status',
  'priority',
  'resolution',
  'resolutiondate',
  'issuelinks',
  SP_FIELD,
  SPRINT_FIELD,
].join(',');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withStatus(error, status) {
  error.status = status;
  return error;
}

// ---- Public API ------------------------------------------------------------

export async function jiraMyself(token) {
  const data = await jiraGet('/rest/api/2/myself', token);
  return { displayName: data.displayName || '', name: data.name || '' };
}

export async function jiraIssue(token, key) {
  const data = await jiraGet(
    `/rest/api/2/issue/${encodeURIComponent(key)}?fields=summary,status,issuetype`,
    token,
  );
  return {
    key: data.key,
    summary: (data.fields && data.fields.summary) || '',
    status: data.fields && data.fields.status ? data.fields.status.name : '',
    issueType: data.fields && data.fields.issuetype ? data.fields.issuetype.name : '',
  };
}

export async function jiraEpicIssues(token, epic) {
  // "Epic Link" ties stories to their epic on Jira Server (field name is config).
  // `epic` is validated by the route against ISSUE_KEY_RE before it reaches here.
  const jql = encodeURIComponent(`${EPIC_LINK_JQL} = ${epic} ORDER BY key ASC`);
  const pageSize = 100;
  let startAt = 0;
  let total = Infinity;
  const issues = [];

  while (startAt < total) {
    const pathAndQuery = `/rest/api/2/search?jql=${jql}&fields=${ISSUE_FIELDS}&startAt=${startAt}&maxResults=${pageSize}`;
    const data = await jiraGet(pathAndQuery, token);
    total = typeof data.total === 'number' ? data.total : (data.issues || []).length;
    (data.issues || []).forEach((issue) => issues.push(shapeIssue(issue)));
    if (!data.issues || data.issues.length === 0) break;
    startAt += data.issues.length;
  }

  return issues;
}

// ---- Shaping (only send the browser what it needs) -------------------------

function shapeIssue(issue) {
  const fields = issue.fields || {};
  const assignee = fields.assignee || null;
  return {
    key: issue.key,
    summary: fields.summary || '',
    issueType: fields.issuetype ? fields.issuetype.name : '',
    status: fields.status ? fields.status.name : '',
    statusCategory:
      fields.status && fields.status.statusCategory ? fields.status.statusCategory.key : '',
    resolution: fields.resolution ? fields.resolution.name : '',
    resolutionDate: fields.resolutiondate || null,
    priority: fields.priority ? fields.priority.name : '',
    storyPoints: fields[SP_FIELD] == null ? null : Number(fields[SP_FIELD]),
    components: (fields.components || []).map((c) => c.name),
    labels: fields.labels || [],
    assignee: assignee
      ? {
          name: assignee.name || '',
          displayName: assignee.displayName || '',
          email: assignee.emailAddress || '',
        }
      : null,
    sprints: parseSprintField(fields[SPRINT_FIELD]),
    blockedBy: blockersOf(fields.issuelinks),
  };
}

// The tickets this issue "is blocked by" (inward side of a Blocking link).
function blockersOf(links) {
  const out = [];
  (links || []).forEach((l) => {
    const inward = ((l.type && l.type.inward) || '').toLowerCase();
    if (inward !== 'is blocked by' || !l.inwardIssue) return;
    const b = l.inwardIssue;
    const f = b.fields || {};
    out.push({
      key: b.key,
      summary: f.summary || '',
      status: f.status ? f.status.name : '',
      done: !!(f.status && f.status.statusCategory && f.status.statusCategory.key === 'done'),
    });
  });
  return out;
}

/**
 * customfield_10510 on Jira Server comes back either as an array of GreenHopper
 * toString() blobs ("...[id=123,state=ACTIVE,name=PAY 2026.15,...]") or as an
 * array of plain objects. Normalise both into {id,name,state,number}.
 */
function parseSprintField(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  const out = [];
  arr.forEach((entry) => {
    if (!entry) return;
    if (typeof entry === 'object') {
      out.push(shapeSprintObj(entry));
      return;
    }
    if (typeof entry === 'string') {
      const get = (k) => {
        const m = entry.match(new RegExp(`${k}=([^,\\]]*)`));
        return m ? m[1] : '';
      };
      out.push(
        normalizeSprint({
          id: get('id'),
          name: get('name'),
          state: get('state'),
          startDate: get('startDate'),
          endDate: get('endDate'),
        }),
      );
    }
  });
  return out.filter(Boolean);
}

function shapeSprintObj(o) {
  return normalizeSprint({
    id: o.id,
    name: o.name,
    state: o.state,
    startDate: o.startDate,
    endDate: o.endDate,
  });
}

function normalizeSprint({ id, name, state, startDate, endDate }) {
  name = (name || '').trim();
  if (!name || name === '<null>') return null;
  // Only PAY-style sprints ("PAY 2026.15" -> 15) map to a board column. Sprints
  // from other boards ("Shop Path 26.11") have no PAY number, so they fall to
  // Backlog instead of inventing a phantom column outside the range being planned.
  let number = null;
  const m = name.match(SPRINT_NUMBER_RE);
  if (m) number = Number(m[1]);
  const clean = (d) => (d && d !== '<null>' ? d : null);
  return {
    id: id ? String(id) : '',
    name,
    state: (state || '').toUpperCase(),
    number: Number.isFinite(number) ? number : null,
    startDate: clean(startDate),
    endDate: clean(endDate),
  };
}

// ---- Low-level Jira GET (with 429/5xx retry) --------------------------------

async function jiraGet(pathAndQuery, token) {
  const maxAttempts = 4;
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await jiraGetOnce(pathAndQuery, token);
    } catch (error) {
      lastError = error;
      const status = error.status || 0;
      const retriable = status === 429 || (status >= 500 && status < 600);
      if (!retriable || attempt === maxAttempts - 1) break;
      const retryAfterSec = Number(error.retryAfter);
      const wait =
        Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? Math.min(retryAfterSec * 1000, 10000)
          : Math.min(500 * Math.pow(2, attempt), 4000);
      await sleep(wait);
    }
  }
  throw lastError;
}

async function jiraGetOnce(pathAndQuery, token) {
  const target = new URL(pathAndQuery, JIRA_BASE);
  let response;
  try {
    response = await fetch(target, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch (error) {
    throw withStatus(new Error(error.message || 'Network error reaching Jira'), 502);
  }

  const body = await response.text();
  const status = response.status || 0;
  if (status >= 200 && status < 300) {
    try {
      return body ? JSON.parse(body) : {};
    } catch {
      throw withStatus(new Error('Invalid JSON from Jira'), 502);
    }
  }

  const err = withStatus(new Error(jiraErrorMessage(status, body)), status);
  if (status === 429) err.retryAfter = response.headers.get('retry-after');
  throw err;
}

// Pull a human-readable message out of a Jira error body ("" if none/unparseable).
function extractJiraMessages(body) {
  try {
    const parsed = JSON.parse(body);
    const messages = parsed.errorMessages || (parsed.errors ? Object.values(parsed.errors) : []);
    return messages && messages.length ? messages.join(', ') : '';
  } catch {
    return '';
  }
}

function jiraErrorMessage(status, body) {
  if (status === 401) return 'Jira rejected the token (401). Check your Personal Access Token.';
  if (status === 403) return 'Jira denied access (403). Your account may lack permission.';
  const messages = extractJiraMessages(body);
  if (status === 400) {
    return messages ? `Jira 400: ${messages}` : 'Jira 400: bad request (is the epic key correct?).';
  }
  if (messages) return `Jira ${status}: ${messages}`;
  return `Jira request failed (${status}).`;
}
