/** Compact 12-cell progress strip for cards and table rows. */
export function PipelineStrip({ cells }) {
  return (
    <div className="pipeline" title={cells.map((c) => `${c.n}. ${c.status}`).join('\n')}>
      {cells.map((c) => (
        <div key={c.n} className={`cell ${c.status}`} />
      ))}
    </div>
  );
}
