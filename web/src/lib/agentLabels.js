// Plain-language labels for the /seph-sdlc chat, so non-developers see
// "PRD Creator — drafting your requirements" instead of a raw Task tool call,
// and "Resuming the pipeline" instead of {"skill":"seph-sdlc","args":"continue"}.
//
// Keyed on the agent ids the pipeline spawns (same ids as AGENT_TO_STAGE in
// server/src/normalize.js) and the /seph-sdlc sub-commands. Icons reuse the
// existing inline icon set.
import {
  IconDoc,
  IconSearch,
  IconTarget,
  IconReports,
  IconLayers,
  IconStages,
  IconTicket,
  IconPencil,
  IconTerminal,
  IconHealth,
  IconPlug,
  IconGit,
  IconRocket,
  IconPlay,
} from '../components/icons';

// agent id -> { label, verb, Icon }. Reviewers/validators share the "reviewing"
// shape so the story reads as doer → reviewer per stage.
export const AGENT_LABELS = {
  // Stage 1 — PRD
  'sephora-prd-creator': { label: 'PRD Creator', verb: 'drafting your requirements', Icon: IconDoc },
  'sephora-prd-reviewer': { label: 'PRD Reviewer', verb: 'reviewing the requirements', Icon: IconSearch },
  'sephora-figma-summarizer': { label: 'Figma Summarizer', verb: 'reading the designs', Icon: IconSearch },
  // Stage 2 — Acceptance tests
  'sephora-acceptance-test-creator': { label: 'Acceptance Tests', verb: 'writing acceptance tests', Icon: IconTarget },
  'sephora-acceptance-test-reviewer': { label: 'Acceptance Test Reviewer', verb: 'reviewing the tests', Icon: IconSearch },
  'sephora-qe-testplan-creator': { label: 'QE Test Plan', verb: 'building the QE test plan', Icon: IconReports },
  'sephora-qe-testplan-generator': { label: 'QE Test Plan', verb: 'building the QE test plan', Icon: IconReports },
  // Stage 3 — Architecture
  'sephora-arch-current-state-creator': { label: 'Current-State Architecture', verb: 'mapping the current architecture', Icon: IconLayers },
  'sephora-arch-target-state-creator': { label: 'Target-State Architecture', verb: 'designing the target architecture', Icon: IconLayers },
  'sephora-arch-reviewer': { label: 'Architecture Reviewer', verb: 'reviewing the architecture', Icon: IconSearch },
  'sephora-adr-creator': { label: 'ADR Author', verb: 'recording an architecture decision', Icon: IconDoc },
  'sephora-wbs-creator': { label: 'Work Breakdown', verb: 'breaking down the work', Icon: IconStages },
  // Stage 4 — Jira
  'sephora-jira-creator': { label: 'Jira Creator', verb: 'breaking work into tickets', Icon: IconTicket },
  'sephora-jira-reviewer': { label: 'Jira Reviewer', verb: 'reviewing the tickets', Icon: IconSearch },
  'sephora-qe-testcase-creator': { label: 'QE Test Cases', verb: 'writing TestRail cases', Icon: IconReports },
  'sephora-qe-testcases-generator': { label: 'QE Test Cases', verb: 'writing TestRail cases', Icon: IconReports },
  // Stage 5 — Dependencies
  'sephora-dependency-checker': { label: 'Dependency Check', verb: 'checking dependencies', Icon: IconStages },
  // Stage 6 — Planning
  'sephora-implementation-planner': { label: 'Implementation Planner', verb: 'planning the implementation', Icon: IconPencil },
  'sephora-implementation-reviewer': { label: 'Plan Reviewer', verb: 'reviewing the plan', Icon: IconSearch },
  // Stage 7 — Tests (TDD red)
  'sephora-test-creator': { label: 'Test Creator', verb: 'writing tests (TDD red)', Icon: IconTarget },
  'sephora-test-reviewer': { label: 'Test Reviewer', verb: 'reviewing the tests', Icon: IconSearch },
  'sephora-test-validator': { label: 'Test Validator', verb: 'validating test coverage', Icon: IconHealth },
  // Stage 8 — Code (TDD green)
  'sephora-code-writer': { label: 'Code Writer', verb: 'writing the code (TDD green)', Icon: IconTerminal },
  'sephora-code-reviewer': { label: 'Code Reviewer', verb: 'reviewing the code', Icon: IconSearch },
  // Stage 9 — Quality gates
  'sephora-quality-gate-validator': { label: 'Quality Gates', verb: 'running quality checks', Icon: IconHealth },
  'sephora-security-scanner': { label: 'Security Scanner', verb: 'scanning for vulnerabilities', Icon: IconSearch },
  'sephora-performance-validator': { label: 'Performance Validator', verb: 'checking performance', Icon: IconHealth },
  'sephora-sre-monitor-checker': { label: 'SRE Readiness', verb: 'checking monitoring & runbooks', Icon: IconHealth },
  // Stage 10-12
  'sephora-local-integration-validator': { label: 'Local Integration', verb: 'validating local integration', Icon: IconPlug },
  'sephora-pr-assembler': { label: 'PR Assembly', verb: 'assembling the pull request', Icon: IconGit },
  'sephora-deployment-agent': { label: 'Deployment', verb: 'deploying the change', Icon: IconRocket },
};

// Friendly fallback for any unmapped agent id: "sephora-foo-bar" -> "Foo Bar".
function titleCase(id) {
  return String(id || 'sub-agent')
    .replace(/^sephora-/, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function agentInfo(id) {
  return AGENT_LABELS[id] || { label: titleCase(id), verb: 'working…', Icon: IconStages };
}

// /seph-sdlc sub-command -> friendly phrase. args is the string after the skill
// name (e.g. "continue payments/test"); first word picks the phrase, the rest is
// the detail (the initiative/jira it targets).
const SKILL_PHRASES = {
  continue: { title: 'Resuming the pipeline', Icon: IconPlay },
  create: { title: 'Starting a new initiative', Icon: IconPlay },
  stage: { title: 'Running a stage', Icon: IconPlay },
  status: { title: 'Checking pipeline status', Icon: IconReports },
  list: { title: 'Listing initiatives', Icon: IconReports },
  sync: { title: 'Syncing from Jira', Icon: IconGit },
};

export function skillInfo(args) {
  const text = String(args || '').trim();
  const [verb, ...rest] = text.split(/\s+/);
  const phrase = SKILL_PHRASES[verb] || { title: 'Running the SDLC pipeline', Icon: IconLayers };
  return { title: phrase.title, detail: rest.join(' '), Icon: phrase.Icon };
}
