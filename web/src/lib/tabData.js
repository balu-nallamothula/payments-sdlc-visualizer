// Central registry of the AMP 360° tabs. Each later phase adds an entry here and
// the detail page maps over this to build the tab bar — disabling a tab whose
// `hasData(ctx)` returns false (graceful degradation for lean initiatives) and
// surfacing an optional `count(ctx)` pill.
//
// ctx = { detail }  where detail = { initiative, pipeline, jiras } (+ raw later).
//
// Phase 1 ships the two tabs backed entirely by existing data; feature tabs
// (Impacted Systems, Impact, Readiness, Contribution, Evidence, Architecture,
// Guardrails, PR Review, FlowGuard) slot in as each phase lands.
import { rowGates } from './gates';
import { artifactsForStage } from './artifacts';

const TAB_REGISTRY = [
  { id: 'overview', label: 'Overview' },
  { id: 'pipeline', label: 'AI SDLC Stages' },
  {
    id: 'contribution',
    label: 'Contribution',
    hasData: ({ detail }) => detail.jiras.length > 0,
  },
  {
    id: 'impacted-systems',
    label: 'Impacted Systems',
    hasData: ({ detail }) => detail.jiras.some((j) => (j.targetRepositories || []).length > 0),
  },
  {
    id: 'impact',
    label: 'Impact',
    hasData: ({ detail }) => detail.jiras.some((j) => j.impactLevel),
  },
  {
    id: 'architecture',
    label: 'Architecture',
    // Reuse the view's own stage-3 selector so enable ↔ render stay in sync.
    hasData: ({ artifacts }) => artifactsForStage(artifacts || [], 3).some((a) => a.ext === '.md'),
  },
  {
    id: 'evidence',
    label: 'Quality Evidence',
    // Enabled only when at least one jira produces a renderable gate row (keeps
    // enable ↔ render in sync — rowGates is exactly what the tab renders).
    hasData: ({ detail }) => detail.jiras.some((j) => rowGates(j)),
  },
  {
    id: 'guardrails',
    label: 'Guardrails',
    hasData: ({ detail }) => detail.jiras.length > 0,
  },
  {
    id: 'pr-review',
    label: 'PR Review',
    hasData: ({ detail }) =>
      detail.jiras.some((j) => (j.prUrl || []).length > 0 || j.deploymentInfo?.pr_url || j.deploymentInfo?.pr_number),
  },
  {
    // External system — not integrated yet; always a disabled "coming soon" tab.
    id: 'flowguard',
    label: 'FlowGuard',
    hasData: () => false,
    disabledTitle: 'Coming soon — FlowGuard is not integrated yet',
  },
  { id: 'readiness', label: 'Readiness' },
];

export function buildTabs(ctx) {
  return TAB_REGISTRY.map((t) => ({
    id: t.id,
    label: t.label,
    count: t.count ? t.count(ctx) : undefined,
    disabled: t.hasData ? !t.hasData(ctx) : false,
    title: t.disabledTitle,
  }));
}
