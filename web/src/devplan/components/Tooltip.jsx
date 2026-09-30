// Reusable rich tooltip rendered in a portal on document.body, so it never gets
// clipped by overflow:hidden parents (e.g. the comp-bar) and can grow larger
// than the native `title` bubble. Usage:
//   const tip = useRichTooltip();
//   <i {...tip.bind(<>...content...</>)} />
//   {tip.node}
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";

const MAX_W = 280;

export function useRichTooltip() {
  const [tip, setTip] = useState(null);

  const hide = useCallback(() => setTip(null), []);

  const show = useCallback((e, content) => {
    const r = e.currentTarget.getBoundingClientRect();
    const below = r.top < 110; // flip below the anchor when near the top edge
    const half = MAX_W / 2;
    const x = Math.max(half + 8, Math.min(window.innerWidth - half - 8, r.left + r.width / 2));
    const y = below ? r.bottom + 9 : r.top - 9;
    setTip({ x, y, below, content });
  }, []);

  const bind = useCallback(
    (content) => ({
      onMouseEnter: (e) => show(e, content),
      onMouseLeave: hide,
      onMouseDown: hide, // dismiss on click/drag start
    }),
    [show, hide]
  );

  const node = tip
    ? createPortal(
        // Portaled to <body>, so wrap in .devplan-root to carry the board's
        // scoped styles + token remap outside the page subtree.
        <div className="devplan-root">
          <div
            className={"rich-tip" + (tip.below ? " below" : "")}
            role="tooltip"
            style={{ left: tip.x, top: tip.y, maxWidth: MAX_W }}
          >
            {tip.content}
          </div>
        </div>,
        document.body
      )
    : null;

  return { bind, node };
}
