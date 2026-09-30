import { useMemo, useState } from 'react';
import { useGit } from '../context/GitContext';
import { IconChevronLeft, IconDoc, IconFolder } from './icons';

const ROOT_KEY = '.';

/** Group artifacts by their folder, rendered as collapsible sections. */
export function ArtifactGrid({ artifacts, onOpen }) {
  const { changed } = useGit();
  const groups = useMemo(() => {
    const map = new Map();
    for (const a of artifacts) {
      const dir = a.dir && a.dir !== '' ? a.dir : ROOT_KEY;
      if (!map.has(dir)) map.set(dir, []);
      map.get(dir).push(a);
    }
    const entries = [...map.entries()];
    entries.sort(([a], [b]) => {
      if (a === ROOT_KEY) return -1;
      if (b === ROOT_KEY) return 1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    for (const [, files] of entries) files.sort((x, y) => x.name.localeCompare(y.name));
    return entries;
  }, [artifacts]);

  const [collapsed, setCollapsed] = useState({});
  const toggle = (dir) => setCollapsed((c) => ({ ...c, [dir]: !c[dir] }));

  if (artifacts.length === 0) return <div className="muted">No artifact files found.</div>;

  return (
    <div>
      {groups.map(([dir, files]) => {
        const isOpen = !collapsed[dir];
        return (
          <div className="artifact-group" key={dir}>
            <button className="group-head" onClick={() => toggle(dir)}>
              <IconFolder width={16} height={16} color="var(--accent)" />
              <span>{dir === ROOT_KEY ? 'General' : dir}</span>
              <span className="gcount">{files.length}</span>
              <IconChevronLeft
                className="chev"
                width={16}
                height={16}
                style={{ transform: isOpen ? 'rotate(-90deg)' : 'rotate(180deg)' }}
              />
            </button>
            {isOpen && (
              <div className="files">
                {files.map((a) => (
                  <button key={a.relPath} className="file" onClick={() => onOpen(a.relPath)} title={a.relPath}>
                    {changed.has(a.relPath) && <span className="file-flag" title="Modified (uncommitted)" />}
                    <span className="ficon">
                      <IconDoc width={18} height={18} />
                    </span>
                    <span className="fmeta">
                      <span className="fname">{a.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
