import { shortName } from "../derive.js";
import { SORT_OPTIONS, defaultShow } from "../config.js";
import Combobox from "./Combobox.jsx";
import Icon from "./Icon.jsx";
import FiltersMenu from "./FiltersMenu.jsx";

export default function Controls({
  epics, systemsPresent, filters, setFilters, sortMode, onSortChange,
  lanesAllCollapsed, onToggleAllLanes, kpisOpen, onToggleKpis, onExport,
}) {
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const toggleFacet = (id) => setFilters((f) => ({ ...f, show: { ...f.show, [id]: !f.show[id] } }));
  const resetFacets = () => setFilters((f) => ({ ...f, show: defaultShow() }));
  const epicOpts = [{ value: "all", label: "All initiatives" }, ...Object.values(epics).map((e) => ({ value: e.key, label: shortName(e) }))];
  const systemOpts = [{ value: "all", label: "All systems" }, ...systemsPresent.map((n) => ({ value: n, label: n }))];

  return (
    <section className="panel controls-panel">
      <div className="controls-left">
        <label className="control"><span className="control-label"><Icon name="flag" size={13} />Initiative</span>
          <Combobox options={epicOpts} value={filters.epic} onChange={(v) => set({ epic: v })} ariaLabel="Initiative" placeholder="All initiatives" />
        </label>
        <label className="control"><span className="control-label"><Icon name="layers" size={13} />System</span>
          <Combobox options={systemOpts} value={filters.system} onChange={(v) => set({ system: v })} ariaLabel="System" placeholder="All systems" />
        </label>
        <label className="control"><span className="control-label"><Icon name="sort" size={13} />Order</span>
          <Combobox options={SORT_OPTIONS} value={sortMode} onChange={onSortChange} ariaLabel="Card order" placeholder="Order" />
        </label>
        <label className="control control-search"><span className="control-label"><Icon name="search" size={13} />Search</span>
          <div className="search-box">
            <Icon name="search" size={15} />
            <input type="search" value={filters.q} placeholder="Search by key or title…" onChange={(e) => set({ q: e.target.value })} />
            <kbd>⌘K</kbd>
          </div>
        </label>
      </div>
      <div className="controls-right">
        <FiltersMenu show={filters.show} onToggle={toggleFacet} onReset={resetFacets} />
        <button className="button ghost with-icon" type="button" onClick={onToggleAllLanes}>
          <Icon name="collapseAll" />
          {lanesAllCollapsed ? "Expand all lanes" : "Collapse all lanes"}
        </button>
        <button className="button ghost with-icon" type="button" onClick={onToggleKpis} title="Show/hide the KPI band">
          <Icon name="kpi" />
          {kpisOpen ? "Hide KPIs" : "Show KPIs"}
        </button>
        <button className="button ghost with-icon" type="button" onClick={onExport} title="Download the current board as JSON">
          <Icon name="export" />
          Export
        </button>
      </div>
    </section>
  );
}
