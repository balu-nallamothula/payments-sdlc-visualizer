/** Compact progress strip for cards and table rows. Done cells run light → dark
 *  green across the sequence; every stage renders (empty ones stay visibly empty). */
export function PipelineStrip({ cells }) {
  const n = cells.length;
  return (
    <div className="pipeline" title={cells.map((c) => `${c.n}. ${c.status}`).join('\n')}>
      {cells.map((c, i) => {
        const style =
          c.status === 'done'
            ? { background: `hsl(140, 52%, ${Math.round(62 - (n > 1 ? (i / (n - 1)) * 30 : 0))}%)` }
            : undefined;
        return <div key={c.n} className={`cell ${c.status}`} style={style} />;
      })}
    </div>
  );
}
