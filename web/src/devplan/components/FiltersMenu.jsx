import { useEffect, useRef, useState } from "react";
import { FILTER_GROUPS, FILTER_FACET_IDS } from "../config.js";
import Icon from "./Icon.jsx";

// Board filter popover: a "Filters" button + a click-outside dropdown of grouped
// checkboxes (Type / Status / Flags). `show` is filters.show ({facetId:boolean},
// lit = shown); onToggle(id) flips one facet; onReset restores defaults. Modeled
// on the Topbar avatar menu.
export default function FiltersMenu({ show, onToggle, onReset }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hiddenCount = FILTER_FACET_IDS.filter((id) => !show[id]).length;

  return (
    <div className="filters-menu" ref={ref}>
      <button
        className={"button ghost with-icon" + (hiddenCount ? " is-active" : "")}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Filter the board by type, status & flags"
      >
        <Icon name="filter" />
        Filters{hiddenCount ? <span className="filters-badge">{hiddenCount}</span> : null}
      </button>

      {open && (
        <div className="filters-panel" role="dialog" aria-label="Filters">
          <div className="filters-panel-head">
            <span>Show on the board</span>
            <button className="button ghost sm" type="button" onClick={onReset} disabled={!hiddenCount}>Reset</button>
          </div>
          {FILTER_GROUPS.map((g) => (
            <div className="filters-group" key={g.key}>
              <span className="filters-group-label">{g.label}</span>
              <div className="filters-group-items">
                {g.facets.map((f) => (
                  <label className="filters-check" key={f.id}>
                    <input type="checkbox" checked={!!show[f.id]} onChange={() => onToggle(f.id)} />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
