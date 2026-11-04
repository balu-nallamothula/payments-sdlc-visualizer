import { useEffect, useRef, useState } from 'react';

// Lazy, code-split Mermaid renderer. `import('mermaid')` keeps the (large) library
// out of the main bundle — it only loads when an Architecture doc with a diagram is
// actually opened. On any load/parse failure it falls back to the raw fenced source
// plus a mermaid.live link, so a malformed diagram never blanks the page.
let mermaidPromise = null;
function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid')
      .then((m) => {
        const mermaid = m.default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
        return mermaid;
      })
      .catch((e) => {
        // Don't cache the rejection (e.g. a stale chunk after deploy) — let the
        // next render retry the import instead of poisoning every diagram.
        mermaidPromise = null;
        throw e;
      });
  }
  return mermaidPromise;
}

let idSeq = 0;

export function Mermaid({ chart }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    getMermaid()
      .then((mermaid) => mermaid.render(`mmd-${(idSeq += 1)}`, chart))
      .then(({ svg }) => {
        if (live && ref.current) ref.current.innerHTML = svg;
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [chart]);

  if (failed) {
    let liveUrl = 'https://mermaid.live/';
    try {
      const state = JSON.stringify({ code: chart, mermaid: { theme: 'default' } });
      liveUrl = `https://mermaid.live/edit#base64:${btoa(unescape(encodeURIComponent(state)))}`;
    } catch {
      /* keep plain url */
    }
    return (
      <pre className="md">
        <code>{chart}</code>
        {'\n'}
        <a href={liveUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
          Open in mermaid.live ↗
        </a>
      </pre>
    );
  }

  return <div className="mermaid-rendered" ref={ref} style={{ overflow: 'auto' }} />;
}
