// Canonical impact-level handling. Metadata casing is inconsistent (HIGH/High/
// high) and includes stray HIGHEST/CRITICAL — map any of them to one bucket,
// plus a badge-color class. Shared by the board, the Impact tab and the steward
// view so impact is read the same way everywhere.
export function impactBucket(level) {
  const s = String(level || '').trim().toUpperCase();
  if (s === 'CRITICAL' || s === 'HIGHEST') return 'critical';
  if (s === 'HIGH') return 'high';
  if (s === 'MEDIUM' || s === 'MED') return 'medium';
  if (s === 'LOW') return 'low';
  return '';
}

// Badge color class (reuses the global .badge variants: crit / warn / ok).
export function impactClass(level) {
  switch (impactBucket(level)) {
    case 'critical':
    case 'high':
      return 'crit';
    case 'medium':
      return 'warn';
    case 'low':
      return 'ok';
    default:
      return '';
  }
}
