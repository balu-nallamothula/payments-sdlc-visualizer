// Map an artifact file to the canonical stage (1–12) it belongs to.
//
// Two on-disk schemes exist:
//   - numeric-prefix folders: artifacts/01-intent, 05-dependencies, 06-planning ...
//     (these use canonical numbering)
//   - stage-N-* root folders (e.g. paze-discover): stage-1-prd, stage-2-arch,
//     stage-3-jira ... whose numbers do NOT match canonical — so we fall back to
//     keyword matching for those.

// Keyword aliases per canonical stage, ordered so more specific stages win first
// (e.g. "implementation-plan" -> Planning(6) before Implementation(8);
//  "acceptance" -> Acceptance Tests(2) before Tests(7)).
const STAGE_KEYWORDS = [
  [6, ['planning', 'implementation-plan', 'impl-plan']],
  [2, ['acceptance', 'testplan', 'test-plan', 'qe-test']],
  [9, ['quality', 'quality-gate', 'security', 'performance', 'combined-report']],
  [10, ['documentation', 'sync-summary', 'changelog']],
  [11, ['pull-request', '11-pr']],
  [12, ['deployment', 'deploy', 'rollout', 'release']],
  [5, ['dependenc']],
  [8, ['implementation', 'code-writer']],
  [7, ['tests', 'test-manifest', 'test-scenarios', 'testcase', 'tdd']],
  [3, ['architecture', 'arch', 'current-state', 'target-state']],
  [4, ['jira', 'stories', 'use-cases', 'use-case', 'epics', 'story']],
  [1, ['prd', 'intent', 'feature-brief', 'boo', 'one-pager']],
];

function numericPrefixStage(dir) {
  for (const seg of dir.split('/')) {
    const m = seg.match(/^(\d{1,2})[a-z]?[-_]/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 12) return n;
    }
  }
  return null;
}

/** Best-guess canonical stage for an artifact, or null if it isn't stage-specific. */
export function canonicalStageForArtifact(a) {
  const dir = (a.dir || '').toLowerCase();
  if (!dir || dir === '.') return null; // General / root files
  if (dir.startsWith('references')) return null; // reference material, not a stage output

  const num = numericPrefixStage(dir);
  if (num) return num;

  const path = `${dir}/${(a.name || '').toLowerCase()}`;
  for (const [n, kws] of STAGE_KEYWORDS) {
    if (kws.some((k) => path.includes(k))) return n;
  }
  return null;
}

/** Filter an artifact list to those belonging to canonical stage `n`. */
export function artifactsForStage(artifacts, n) {
  return artifacts.filter((a) => canonicalStageForArtifact(a) === n);
}
