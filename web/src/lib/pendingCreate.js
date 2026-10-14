// Tracks whether a `/seph-sdlc create` is in flight, so the app can jump to the
// new initiative the moment the pipeline writes its metadata.json (which is what
// makes it a real, navigable initiative). Set when a create command is sent;
// consumed by the SSE watcher when the metadata appears.

let pendingAt = null;
const MAX_AGE_MS = 30 * 60 * 1000; // a create (intent gate → scaffold) can take a while

export function markPendingCreate() {
  pendingAt = Date.now();
}

export function hasPendingCreate() {
  return pendingAt != null && Date.now() - pendingAt < MAX_AGE_MS;
}

// Returns true (and clears the flag) if a create was pending and still fresh.
export function consumePendingCreate() {
  const ok = hasPendingCreate();
  pendingAt = null;
  return ok;
}
