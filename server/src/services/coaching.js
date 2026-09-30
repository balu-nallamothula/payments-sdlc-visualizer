// Parses the seph-sdlc-coach stage coaching cards into a structured shape,
// and exposes the reference docs (intro/concepts/troubleshooting) as raw markdown.
//
// Card shape (no frontmatter):
//   ## Stage <N> — <Name>
//   **Time:** ~20-30 min | **Gate:** Yes (...)      (or "**No Gate**")
//   ### <Section heading>
//   ...body...
// Stage 12 has a trailing second H2 (## Congratulations) treated as an epilogue.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { CANONICAL_STAGES } from '../normalize.js';

const REFERENCE_DOCS = ['intro', 'concepts', 'troubleshooting'];

async function readFileSafe(file) {
  try {
    return await fsp.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

/** Find the coaching-card file for a canonical stage number, tolerant of naming. */
async function findStageFile(n) {
  const dir = config.coachStagesDir;
  if (!dir || !fs.existsSync(dir)) return null;
  let files;
  try {
    files = await fsp.readdir(dir);
  } catch {
    return null;
  }
  // Match "stage-<n>-*.md" but not "stage-<n><letter>" (e.g. avoid stage-10 matching stage-1).
  const re = new RegExp(`^stage-${n}-`);
  const match = files.find((f) => re.test(f) && f.endsWith('.md'));
  return match ? path.join(dir, match) : null;
}

/** Parse a stage card's markdown into structured sections. */
export function parseStageCard(md, fallbackN) {
  const lines = md.split(/\r?\n/);

  // Title (first H2).
  let title = null;
  let n = fallbackN ?? null;
  const titleLine = lines.find((l) => /^##\s+/.test(l));
  if (titleLine) {
    title = titleLine.replace(/^##\s+/, '').trim();
    const m = title.match(/Stage\s+(\d+)/i);
    if (m) n = parseInt(m[1], 10);
  }

  // Metadata line (Time / Gate).
  let time = null;
  let gate = null;
  const metaLine = lines.find((l) => /\*\*Time:\*\*/.test(l) || /\*\*No Gate\*\*/.test(l) || /\*\*Gate:\*\*/.test(l));
  if (metaLine) {
    const tm = metaLine.match(/\*\*Time:\*\*\s*([^|]+)/);
    if (tm) time = tm[1].trim();
    if (/\*\*No Gate\*\*/.test(metaLine)) gate = 'No';
    else {
      const gm = metaLine.match(/\*\*Gate:\*\*\s*(.+)$/);
      if (gm) gate = gm[1].trim();
    }
  }

  // Split into sections on H3 headings; collect a trailing H2 as epilogue.
  const sections = [];
  let epilogue = null;
  let current = null;
  let epilogueBuf = null;
  let sawFirstH2 = false;

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (!sawFirstH2) {
        sawFirstH2 = true; // this is the title H2
        continue;
      }
      // A second H2 -> start epilogue capture.
      if (current) {
        sections.push(current);
        current = null;
      }
      epilogueBuf = { heading: line.replace(/^##\s+/, '').trim(), body: [] };
      continue;
    }
    if (epilogueBuf) {
      epilogueBuf.body.push(line);
      continue;
    }
    if (/^###\s+/.test(line)) {
      if (current) sections.push(current);
      current = { heading: line.replace(/^###\s+/, '').trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) sections.push(current);
  if (epilogueBuf) {
    epilogue = { heading: epilogueBuf.heading, markdown: epilogueBuf.body.join('\n').trim() };
  }

  return {
    n,
    title,
    time,
    gate,
    sections: sections.map((s) => ({ heading: s.heading, markdown: s.body.join('\n').trim() })),
    epilogue,
  };
}

/** Return all 12 parsed stage cards (merged with canonical stage metadata). */
export async function getStages() {
  const out = [];
  for (const stage of CANONICAL_STAGES) {
    const file = await findStageFile(stage.n);
    let card = null;
    if (file) {
      const md = await readFileSafe(file);
      if (md) card = parseStageCard(md, stage.n);
    }
    out.push({
      n: stage.n,
      name: stage.name,
      phase: stage.phase,
      agent: stage.agent,
      card, // null if the coach skill isn't installed
      hasCard: !!card,
    });
  }
  return out;
}

/** Return one parsed stage card. */
export async function getStage(n) {
  const stages = await getStages();
  return stages.find((s) => s.n === Number(n)) || null;
}

/** Return a reference doc as raw markdown. */
export async function getReferenceDoc(name) {
  if (!REFERENCE_DOCS.includes(name)) return null;
  const dir = config.coachStagesDir;
  if (!dir) return null;
  const file = path.join(dir, `${name}.md`);
  const md = await readFileSafe(file);
  return md == null ? null : { name, markdown: md };
}

export { REFERENCE_DOCS };
