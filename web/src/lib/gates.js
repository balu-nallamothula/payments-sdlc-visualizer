// Quality-gate handling, shared by the Evidence tab, the tab-enable predicate and
// the Readiness score so "does this gate pass?" is answered one way everywhere.

// The six canonical gate dimensions.
export const GATES = [
  { key: 'security', label: 'Security' },
  { key: 'test', label: 'Test' },
  { key: 'performance', label: 'Perf' },
  { key: 'sre', label: 'SRE' },
  { key: 'local_integration', label: 'Local int.' },
  { key: 'supergraph_composition', label: 'Supergraph' },
];

// Alternate key spellings seen in the heterogeneous top-level quality_results.
const ALIASES = {
  local_integration: ['integration', 'local_int'],
  performance: ['perf'],
  supergraph_composition: ['supergraph'],
};

// The gate map for one jira: prefer the stage-9 gate_results; otherwise fall back
// to the top-level quality_results (mapping only recognizable dimensions, so an
// unrelated quality_results shape yields null rather than wrong cells). Returns a
// { dim: value } object or null when there is nothing renderable.
export function rowGates(jira) {
  if (jira.gateResults && Object.keys(jira.gateResults).length) return jira.gateResults;
  const q = jira.qualityResults;
  if (!q || typeof q !== 'object') return null;
  const out = {};
  for (const g of GATES) {
    const candidates = [
      g.key,
      `${g.key}_passed`,
      `${g.key}_status`,
      ...(ALIASES[g.key] || []).flatMap((a) => [a, `${a}_passed`]),
    ];
    for (const c of candidates) {
      if (q[c] != null) {
        out[g.key] = typeof q[c] === 'boolean' ? (q[c] ? 'pass' : 'fail') : q[c];
        break;
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

// Classify a free-text / boolean gate value by its LEADING verdict word, so
// "pass (28/28, 0 failing)" reads its "pass" rather than matching "fail" anywhere.
export function gateState(v) {
  if (v == null || v === '') return { cls: '', label: '—' };
  if (typeof v === 'boolean') return v ? { cls: 'ok', label: 'pass' } : { cls: 'crit', label: 'fail' };
  const head = String(v).toLowerCase().match(/[a-z]+/)?.[0] || '';
  if (head.startsWith('fail') || head.startsWith('error') || head.startsWith('block')) return { cls: 'crit', label: 'fail' };
  if (head.startsWith('skip') || head === 'absent' || head === 'na' || head === 'n') return { cls: '', label: 'skip' };
  if (head.startsWith('pass') || head === 'ok' || head === 'green' || head === 'done') return { cls: 'ok', label: 'pass' };
  return { cls: 'warn', label: String(v).slice(0, 8) };
}

// For scoring: a gate counts as "not blocking" when it passes or is skipped/absent.
export function gatePasses(v) {
  const { label } = gateState(v);
  return label === 'pass' || label === 'skip';
}
