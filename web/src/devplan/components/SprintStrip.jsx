import { useRef, useState } from "react";
import { CompBar } from "./Composition.jsx";
import Icon from "./Icon.jsx";
import { readDropKey } from "../dnd.js";

function SprintPill({ s, active, onSelect, onMove }) {
  const [over, setOver] = useState(false);
  return (
    <button
      className={"strip-pill" + (active ? " is-active" : "") + (over ? " drop-over" : "")}
      type="button"
      onClick={() => onSelect(s.key)}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!over) setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); const k = readDropKey(e); if (k) onMove(k, s.key); }}
    >
      <span className="strip-name">{active && <Icon name="cal" size={13} />}{s.label}</span>
      <span className="strip-sp">{s.total} SP</span>
      <CompBar comp={s.comp} mini />
    </button>
  );
}

export default function SprintStrip({ sprints, selectedKey, onSelect, onMove }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  return (
    <div className="strip">
      <button className="strip-arrow" type="button" aria-label="Scroll left" onClick={() => scroll(-1)}>‹</button>
      <div className="strip-track" ref={ref}>
        {sprints.map((s) => (
          <SprintPill key={s.key} s={s} active={s.key === selectedKey} onSelect={onSelect} onMove={onMove} />
        ))}
      </div>
      <button className="strip-arrow" type="button" aria-label="Scroll right" onClick={() => scroll(1)}>›</button>
    </div>
  );
}
