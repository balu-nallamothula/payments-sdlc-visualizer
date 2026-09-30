// Frontend-side helpers for the canonical 12-stage model.

export const STAGE_FOCUS = {
  1: 'Expand the feature brief into a full PRD: requirements, acceptance criteria, scope, business rules.',
  2: 'Turn the PRD into executable end-to-end acceptance test scenarios (the failing tests to satisfy).',
  3: 'Document current-state and design target-state architecture, then review it against principles.',
  4: 'Break the work into right-sized Jira stories and sub-tasks, then review them for coverage.',
  5: 'Verify every dependency is ready before implementation begins (a fail-fast gate).',
  6: 'Define the implementation approach, tasks, and dependencies before coding begins.',
  7: 'Write integration and unit tests first (TDD RED) — they should fail until the code exists.',
  8: 'Write production code until all tests pass (TDD GREEN).',
  9: 'Run the quality gates: security, performance, SRE, and test validation.',
  10: 'Sync documentation and validate local integration before opening a PR.',
  11: 'Assemble the pull request with all evidence from the pipeline.',
  12: 'Deploy to pre-prod / prod with monitoring and rollback support.',
};

export const STATUS_LABEL = {
  done: 'Done',
  active: 'Active',
  pending: 'Pending',
  skipped: 'Skipped',
  blocked: 'Blocked',
};

/** Build a rough 12-cell strip for a summary card (detail view computes the precise one). */
export function summaryCells(init) {
  const cells = [];
  const cur = init.currentStageN ?? 0;
  for (let n = 1; n <= 12; n++) {
    const fromInit = init.initiativeStages?.find((c) => c.n === n);
    let status;
    if (fromInit && n <= 4) status = fromInit.status;
    else if (init.phase === 'per-jira') {
      if (n < cur) status = 'done';
      else if (n === cur) status = 'active';
      else status = 'pending';
    } else {
      status = n <= 4 ? fromInit?.status ?? 'pending' : 'pending';
    }
    cells.push({ n, status });
  }
  return cells;
}
