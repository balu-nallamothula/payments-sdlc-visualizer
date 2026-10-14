// Drag-and-drop contract for re-planning a ticket by dragging its card between
// sprints. The drag source (Card) and the drop target (SprintPill) must agree
// on this transfer key — keep both sides going through these helpers.
export const DND_KEY = "text/plain";

export function startCardDrag(e, key) {
  e.dataTransfer.setData(DND_KEY, key);
  e.dataTransfer.effectAllowed = "move";
}

export function readDropKey(e) {
  return e.dataTransfer.getData(DND_KEY);
}
