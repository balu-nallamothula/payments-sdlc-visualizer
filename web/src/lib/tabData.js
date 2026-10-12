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
const TAB_REGISTRY = [
  { id: 'overview', label: 'Overview' },
  { id: 'pipeline', label: 'AI SDLC Stages' },
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
  { id: 'readiness', label: 'Readiness' },
];

export function buildTabs(ctx) {
  return TAB_REGISTRY.map((t) => ({
    id: t.id,
    label: t.label,
    count: t.count ? t.count(ctx) : undefined,
    disabled: t.hasData ? !t.hasData(ctx) : false,
  }));
}
