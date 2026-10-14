// Owner/contributor identity helpers. An owner is either an email
// (oscar.solano@…) or an already-formatted name ("Solano, Oscar"); derive a
// display name and avatar initials handling both. Shared by the Jira detail and
// the Contribution Hub so people render the same way everywhere.
export function displayName(owner) {
  if (!owner) return 'Unassigned';
  if (!owner.includes('@')) return owner; // already a display name
  const parts = owner.split('@')[0].split(/[._-]/).filter(Boolean);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return parts.length >= 2 ? `${cap(parts[parts.length - 1])}, ${cap(parts[0])}` : cap(parts[0] || owner);
}

export function initials(owner) {
  if (!owner) return '—';
  const src = owner.includes('@') ? owner.split('@')[0] : owner;
  const parts = src.split(/[.\s,_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}
