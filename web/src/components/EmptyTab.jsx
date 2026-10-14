// Shared empty state for a 360° tab with no backing data (lean initiatives, or
// a capability that isn't wired yet). Keeps the tab area from looking broken.
export function EmptyTab({ reason }) {
  return (
    <div
      className="card"
      style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)', fontSize: 13 }}
    >
      {reason || 'Nothing captured yet.'}
    </div>
  );
}
