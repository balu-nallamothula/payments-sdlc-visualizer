import { CompBar, CompLegend } from "./Composition.jsx";

export default function Kpis({ kpis }) {
  const comp = {
    done: kpis.doneSP,
    inqa: kpis.inqaSP,
    review: kpis.reviewSP,
    progress: kpis.progressSP,
    todo: kpis.todoSP,
    blocked: kpis.blockedSP,
    total: kpis.totalSP,
  };
  return (
    <section className="kpi-row">
      <article className="metric-card">
        <span>Tickets</span>
        <strong>{kpis.tickets}</strong>
        <small>{kpis.dropped} dropped</small>
      </article>
      <article className="metric-card">
        <span>Story points</span>
        <strong>{kpis.totalSP}</strong>
        <small>excl. dropped</small>
      </article>
      <article className="metric-card composition">
        <span>Work composition <em className="comp-scope">· all sprints</em></span>
        <CompBar comp={comp} />
        <CompLegend comp={comp} />
      </article>
    </section>
  );
}
