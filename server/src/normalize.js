// Canonical SDLC model + defensive normalization.
//
// The sephora-project-docs metadata.json files vary a lot between initiatives
// (stage keys, status strings, array element types, current_stage type, ...).
// Everything here maps those raw variants onto ONE canonical 12-stage model so
// the rest of the app can rely on a stable shape.

/** The canonical 12 stages. Stages 1-4 are initiative-scoped; 5-12 are per-Jira. */
export const CANONICAL_STAGES = [
  { n: 1, name: 'PRD Creation', phase: 'initiative', agent: 'sephora-prd-creator' },
  { n: 2, name: 'Acceptance Tests', phase: 'initiative', agent: 'sephora-acceptance-test-creator' },
  { n: 3, name: 'Architecture', phase: 'initiative', agent: 'sephora-arch-target-state-creator' },
  { n: 4, name: 'Jira Management', phase: 'initiative', agent: 'sephora-jira-creator' },
  { n: 5, name: 'Dependency Check', phase: 'per-jira', agent: 'sephora-dependency-checker' },
  { n: 6, name: 'Implementation Planning', phase: 'per-jira', agent: 'sephora-implementation-planner' },
  { n: 7, name: 'Test Creation (TDD RED)', phase: 'per-jira', agent: 'sephora-test-creator' },
  { n: 8, name: 'Code Writing (TDD GREEN)', phase: 'per-jira', agent: 'sephora-code-writer' },
  { n: 9, name: 'Quality Gates', phase: 'per-jira', agent: 'sephora-quality-gate-validator' },
  { n: 10, name: 'Documentation', phase: 'per-jira', agent: 'sephora-local-integration-validator' },
  { n: 11, name: 'PR Assembly', phase: 'per-jira', agent: 'sephora-pr-assembler' },
  { n: 12, name: 'Deployment', phase: 'per-jira', agent: 'sephora-deployment-agent' },
];

export const TOTAL_STAGES = CANONICAL_STAGES.length;

// Agent name -> canonical stage number. More reliable than the numeric key,
// because some initiatives shift jira-creator between key "4" and key "5".
const AGENT_TO_STAGE = {
  'sephora-prd-creator': 1,
  'sephora-prd-reviewer': 1,
  'sephora-acceptance-test-creator': 2,
  'sephora-acceptance-test-reviewer': 2,
  'sephora-qe-testplan-creator': 2,
  'sephora-arch-current-state-creator': 3,
  'sephora-arch-target-state-creator': 3,
  'sephora-arch-reviewer': 3,
  'sephora-jira-creator': 4,
  'sephora-jira-reviewer': 4,
  'sephora-qe-testcase-creator': 4,
  'sephora-dependency-checker': 5,
  'sephora-implementation-planner': 6,
  'sephora-implementation-reviewer': 6,
  'sephora-test-creator': 7,
  'sephora-test-reviewer': 7,
  'sephora-code-writer': 8,
  'sephora-code-reviewer': 8,
  'sephora-quality-gate-validator': 9,
  'sephora-local-integration-validator': 10,
  'sephora-pr-assembler': 11,
  'sephora-deployment-agent': 12,
};

/** Normalize any status string to a small canonical set. */
export function normalizeStatus(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (['complete', 'completed', 'done', 'imported', 'success', 'passed'].includes(s)) return 'done';
  if (['not_applicable', 'not applicable', 'n/a', 'skipped', 'skip'].includes(s)) return 'skipped';
  if (['in_progress', 'in progress', 'active', 'running', 'started'].includes(s)) return 'active';
  if (['blocked', 'failed', 'error', 'needs_revision'].includes(s)) return 'blocked';
  return 'pending';
}

/**
 * Map a raw stage entry to a canonical stage number.
 * Prefers the entry's agent name; falls back to the leading integer of the key.
 */
export function normalizeStageKey(rawKey, entry) {
  const agent = entry && typeof entry === 'object' ? entry.agent : undefined;
  if (agent && AGENT_TO_STAGE[agent]) return AGENT_TO_STAGE[agent];
  const m = String(rawKey ?? '').match(/\d+/);
  if (m) {
    const n = parseInt(m[0], 10);
    if (n >= 1 && n <= TOTAL_STAGES) return n;
  }
  return null;
}

/** current_stage can be an int, a numeric string, or a word like "completed". */
export function normalizeCurrentStage(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw ?? '').trim().toLowerCase();
  if (['completed', 'complete', 'done', 'finished'].includes(s)) return TOTAL_STAGES;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/** jiras_created may be strings OR objects with varying keys. Always return objects. */
export function normalizeJiras(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((j) => {
      if (typeof j === 'string') return { id: j, title: null };
      if (j && typeof j === 'object') {
        return {
          id: j.id || j.jira_key || j.key || j.jira_id || null,
          title: j.title || null,
          impactLevel: j.impact_level || null,
          epic: j.epic || j.epic_id || null,
          storyPoints: j.story_points ?? null,
          preExisting: j.pre_existing ?? null,
          url: j.jira_url || j.url || null,
          blocks: Array.isArray(j.blocks) ? j.blocks : [],
          blockedBy: Array.isArray(j.blocked_by) ? j.blocked_by : [],
        };
      }
      return null;
    })
    .filter((j) => j && j.id);
}

/** target_repositories may be strings OR objects. Always return objects. */
export function normalizeRepos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (typeof r === 'string') return { name: r };
      if (r && typeof r === 'object') {
        return {
          name: r.name || null,
          organization: r.organization || null,
          url: r.url || null,
          path: r.path || null,
          branch: r.branch || null,
        };
      }
      return null;
    })
    .filter(Boolean);
}

/** Convergence tracking exists as a nested object OR a flat integer. Normalize both. */
export function normalizeConvergence(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.convergence_loop && typeof entry.convergence_loop === 'object') {
    const cl = entry.convergence_loop;
    return {
      iterations: cl.current_iteration ?? cl.iteration ?? null,
      maxIterations: cl.max_iterations ?? null,
      status: cl.loop_status || cl.status || null,
      nextStageReady: cl.next_stage_ready ?? null,
      findingsBySeverity: cl.findings_by_severity || null,
      totalFindings:
        cl.last_reviewer_result?.total_findings ?? cl.total_findings ?? null,
    };
  }
  if (typeof entry.convergence_iterations === 'number') {
    return { iterations: entry.convergence_iterations };
  }
  return null;
}

/** blocking_conditions may be strings or objects. Normalize to {type, description}. */
export function normalizeBlocking(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      if (typeof b === 'string') return { type: 'blocking', description: b };
      if (b && typeof b === 'object') {
        return { type: b.type || 'blocking', description: b.description || JSON.stringify(b) };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Collapse a raw `stages` object into 12 canonical stage cells for a given phase set.
 * Returns an array of { n, name, phase, status, agents[], entries[], convergence }.
 *
 * @param {object} rawStages metadata.stages
 * @param {number[]} phaseStageNumbers which canonical stage numbers this metadata governs
 * @param {number|null} currentStageN normalized current_stage (used to mark the active cell)
 */
export function buildStageCells(rawStages, phaseStageNumbers, currentStageN) {
  // Group raw entries by canonical stage number.
  const byStage = new Map();
  if (rawStages && typeof rawStages === 'object') {
    for (const [key, val] of Object.entries(rawStages)) {
      const n = normalizeStageKey(key, val);
      if (!n) continue;
      if (!byStage.has(n)) byStage.set(n, []);
      byStage.get(n).push({ key, ...(val && typeof val === 'object' ? val : { status: val }) });
    }
  }

  return phaseStageNumbers.map((n) => {
    const meta = CANONICAL_STAGES.find((s) => s.n === n);
    const rawEntries = byStage.get(n) || [];
    // Only entries with a real status drive the stage's state. Some initiatives
    // add an aggregate carrier key (e.g. bare "6" alongside "6a"/"6b") that holds
    // ONLY a convergence_loop and no status — those must not count as "pending".
    const statusEntries = rawEntries.filter(
      (e) => e.status !== undefined && e.status !== null && e.status !== '',
    );
    const statuses = statusEntries.map((e) => normalizeStatus(e.status));

    let status;
    if (statuses.length === 0) {
      status = 'pending';
    } else if (statuses.includes('blocked')) {
      status = 'blocked';
    } else if (statuses.includes('active')) {
      status = 'active';
    } else if (statuses.every((s) => s === 'done' || s === 'skipped')) {
      status = statuses.every((s) => s === 'skipped') ? 'skipped' : 'done';
    } else if (statuses.includes('done')) {
      // Some sub-steps done, others pending -> in progress.
      status = 'active';
    } else {
      status = 'pending';
    }

    // current_stage is the authoritative pointer: every stage BEFORE it is
    // complete (the pipeline STOPs at each boundary and can't advance without
    // completing/overriding), and the stage it points at is the active one.
    if (currentStageN != null) {
      if (n < currentStageN && status !== 'skipped' && status !== 'blocked') {
        status = 'done';
      } else if (n === currentStageN && status !== 'done' && status !== 'blocked') {
        status = 'active';
      }
    }

    // Convergence can live on any raw entry, including the status-less carriers.
    let convergence = null;
    for (const e of rawEntries) {
      const c = normalizeConvergence(e);
      if (c) {
        convergence = c;
        break;
      }
    }

    return {
      n,
      name: meta?.name || `Stage ${n}`,
      phase: meta?.phase || 'per-jira',
      status,
      agents: [...new Set(rawEntries.map((e) => e.agent).filter(Boolean))],
      entries: statusEntries.map((e) => ({
        key: e.key,
        status: normalizeStatus(e.status),
        agent: e.agent || null,
        completedAt: e.completed_at || null,
        optional: e.optional ?? null,
      })),
      convergence,
    };
  });
}

const INITIATIVE_STAGE_NUMBERS = [1, 2, 3, 4];
const PER_JIRA_STAGE_NUMBERS = [5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Normalize an initiative's top-level metadata (does NOT read jiras from disk).
 * @param {object} args { id, relPath, meta, jiraDirCount }
 */
export function normalizeInitiative({ id, relPath, meta, jiraDirCount = 0 }) {
  const m = meta || {};
  const phase = String(m.phase || '').toLowerCase() === 'per-jira' ? 'per-jira' : 'initiative';
  const currentStageN = normalizeCurrentStage(m.current_stage);
  const jiras = normalizeJiras(m.jiras_created);
  const blocking = normalizeBlocking(m.blocking_conditions);

  // Initiative-phase cells (1-4) come from this metadata.
  const initiativeStages = buildStageCells(m.stages, INITIATIVE_STAGE_NUMBERS, currentStageN);
  const initiativeDone = initiativeStages.filter((c) => c.status === 'done' || c.status === 'skipped').length;

  // Rough overall percent for list cards (detail endpoint computes the precise per-jira aggregate).
  let percent;
  if (phase === 'initiative') {
    percent = Math.round((initiativeDone / INITIATIVE_STAGE_NUMBERS.length) * (INITIATIVE_STAGE_NUMBERS.length / TOTAL_STAGES) * 100);
  } else {
    const cs = currentStageN ?? 5;
    percent = Math.round((Math.min(cs, TOTAL_STAGES) / TOTAL_STAGES) * 100);
  }

  return {
    id, // folder-derived slug used in URLs
    relPath, // path under the year dir (may be pod-nested)
    initiativeId: m.initiative_id || null,
    initiativeName: m.initiative_name || id,
    phase,
    currentStageN,
    createdAt: m.created_at || null,
    lateEntry: m.late_entry ?? null,
    greenfield: m.greenfield ?? null,
    blocking,
    blockingCount: blocking.length,
    jiraCount: jiras.length || jiraDirCount || 0,
    jirasCreated: jiras,
    initiativeStages,
    percent: Math.max(0, Math.min(100, percent)),
  };
}

/** Normalize a single Jira's metadata (per-jira phase, stages 5-12). */
export function normalizeJira({ id, relPath, meta }) {
  const m = meta || {};
  const currentStageN = normalizeCurrentStage(m.current_stage);
  const stages = buildStageCells(m.stages, PER_JIRA_STAGE_NUMBERS, currentStageN);
  const done = stages.filter((c) => c.status === 'done' || c.status === 'skipped').length;
  const blocking = normalizeBlocking(m.blocking_conditions);

  return {
    id: m.jira_key || id,
    relPath,
    title: m.title || null,
    epic: m.epic || m.epic_id || null,
    impactLevel: m.impact_level || null,
    storyPoints: m.story_points ?? null,
    status: m.status || m.lifecycle_status || null,
    lifecycleStatus: m.lifecycle_status || null,
    currentStageN,
    prUrl: Array.isArray(m.pr_url) ? m.pr_url : m.pr_url ? [m.pr_url] : [],
    branchName: m.branch_name || null,
    docsBranch: m.docs_branch || null,
    targetRepositories: normalizeRepos(m.target_repositories),
    blocks: Array.isArray(m.blocks) ? m.blocks : [],
    blockedBy: Array.isArray(m.blocked_by) ? m.blocked_by : [],
    blocking,
    blockingCount: blocking.length,
    stages,
    percent: Math.round((done / PER_JIRA_STAGE_NUMBERS.length) * 100),
  };
}

/**
 * Build the full 12-cell pipeline for an initiative given its normalized jiras.
 * Stages 1-4 from the initiative; 5-12 aggregated across jiras.
 */
export function buildInitiativePipeline(initiative, jiras) {
  const cells = [...initiative.initiativeStages];

  for (const n of PER_JIRA_STAGE_NUMBERS) {
    const meta = CANONICAL_STAGES.find((s) => s.n === n);
    if (!jiras || jiras.length === 0) {
      cells.push({ n, name: meta.name, phase: 'per-jira', status: 'pending', aggregate: { done: 0, total: 0 } });
      continue;
    }
    const cellStatuses = jiras.map((j) => j.stages.find((c) => c.n === n)?.status || 'pending');
    const doneCount = cellStatuses.filter((s) => s === 'done' || s === 'skipped').length;
    let status;
    if (cellStatuses.some((s) => s === 'blocked')) status = 'blocked';
    else if (doneCount === jiras.length) status = 'done';
    else if (cellStatuses.some((s) => s === 'active' || s === 'done')) status = 'active';
    else status = 'pending';
    cells.push({ n, name: meta.name, phase: 'per-jira', status, aggregate: { done: doneCount, total: jiras.length } });
  }

  const done = cells.filter((c) => c.status === 'done' || c.status === 'skipped').length;
  return { cells, percent: Math.round((done / TOTAL_STAGES) * 100) };
}
