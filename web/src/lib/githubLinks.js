// Rewrite relative source-file links inside artifact markdown to GitHub URLs.
// Artifacts written by the pipeline reference repo files by path; in the browser
// those would resolve against localhost. We turn them into
// https://github.com/<org>/<repo>/blob/<branch>/<path>#L<line>.
//
// The first path segment is a repo name in SOME artifacts
// (e.g. "illuminate-services-payment-service-app/core/...") but NOT others
// (e.g. "projects/ui/src/..." which is relative to the context repo). We only
// treat the first segment as a repo when it looks like one; otherwise the path
// is relative to the initiative/Jira's primary target repo.

const DEFAULT_ORG = 'Sephora-US-Digital';

// Known default branches (target_repositories only records feature branches).
const KNOWN_DEFAULT_BRANCH = {
  'illuminate-frontend-ufe': 'dev',
};

function parseRepoUrl(url) {
  if (!url) return null;
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
  return m ? { org: m[1], repo: m[2] } : null;
}

// A segment is a repo name if it's a known target repo or matches Sephora's
// repo naming convention (illuminate-* / sephora-*).
function looksLikeRepo(seg, repoNames) {
  return repoNames.has(seg) || /^(illuminate|sephora)[-.]/i.test(seg);
}

/**
 * @param {{ org?: string, defaultBranch?: string, repos?: Array }} ctx
 * @returns {(href: string) => string}
 */
export function makeLinkTransformer(ctx = {}) {
  const repos = (ctx.repos || [])
    .map((r) => ({
      name: r.name || parseRepoUrl(r.url)?.repo,
      org: r.organization || parseRepoUrl(r.url)?.org || ctx.org || DEFAULT_ORG,
    }))
    .filter((r) => r.name);

  const repoNames = new Set(repos.map((r) => r.name));
  const primary = repos[0] || null;
  const defaultOrg = ctx.org || primary?.org || DEFAULT_ORG;

  const orgFor = (repo) => repos.find((r) => r.name === repo)?.org || defaultOrg;
  const branchFor = (repo) => KNOWN_DEFAULT_BRANCH[repo] || ctx.defaultBranch || 'main';

  return function transform(href) {
    if (!href) return href;
    // Leave absolute links, anchors, and non-web schemes alone.
    if (/^(https?:|mailto:|tel:|#|\/\/)/i.test(href)) return href;

    let path = href.replace(/^\.?\//, '');

    // Trailing line reference: :81 or :10-32  ->  #L81 / #L10-L32
    let line = '';
    const lm = path.match(/:(\d+)(?:-(\d+))?$/);
    if (lm) {
      line = `#L${lm[1]}${lm[2] ? `-L${lm[2]}` : ''}`;
      path = path.slice(0, lm.index);
    }

    const segs = path.split('/').filter(Boolean);
    if (segs.length === 0) return href;

    let repo;
    let rest;
    if (looksLikeRepo(segs[0], repoNames)) {
      repo = segs[0];
      rest = segs.slice(1).join('/');
    } else if (primary) {
      // Path is relative to the context repo root — keep the whole path.
      repo = primary.name;
      rest = segs.join('/');
    } else {
      repo = segs[0];
      rest = segs.slice(1).join('/');
    }

    const org = orgFor(repo);
    const branch = branchFor(repo);
    if (!rest) return `https://github.com/${org}/${repo}`;
    return `https://github.com/${org}/${repo}/blob/${branch}/${rest}${line}`;
  };
}
