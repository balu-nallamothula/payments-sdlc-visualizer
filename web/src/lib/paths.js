// Browser-URL helpers for initiative/Jira routes.
//
// Initiative ids are slash-containing paths (e.g. "payments/paze-discover"), so
// they map onto REAL path segments — /initiatives/payments/paze-discover — rather
// than a single %2F-encoded segment. Each segment is still individually
// encoded/decoded so an odd character in a folder name can't break the path.

const encodeSegments = (id) =>
  String(id)
    .split('/')
    .map(encodeURIComponent)
    .join('/');

const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// Link target for an initiative detail page.
export const initiativePath = (id) => `/initiatives/${encodeSegments(id)}`;

// Link target for a Jira detail page nested under its initiative.
export const jiraPath = (id, jiraId) =>
  `${initiativePath(id)}/jiras/${encodeURIComponent(jiraId)}`;

// Split the /initiatives/* splat back into { name, jiraId }. The initiative name
// may contain slashes; a trailing "/jiras/<id>" (single segment) selects a Jira.
export function parseInitiativeSplat(splat) {
  const decoded = (splat || '')
    .split('/')
    .map(safeDecode)
    .join('/');
  const m = decoded.match(/^(.+)\/jiras\/([^/]+)$/);
  if (m) return { name: m[1], jiraId: m[2] };
  return { name: decoded, jiraId: null };
}
