// Reusable tab bar for the AMP 360° view. Reuses the existing `.chat-tabs`
// visual language (underline + count pill) but left-aligns and wraps — the
// detail view grows to many tabs, unlike the 2-tab chat panel (so it overrides
// the chat tab's `flex: 1` stretch inline rather than adding new CSS).
//
// tabs: [{ id, label, count?, disabled? }]  ·  active: id  ·  onSelect(id)
export function Tabs({ tabs, active, onSelect }) {
  return (
    <div className="chat-tabs" style={{ flexWrap: 'wrap' }} role="tablist">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`chat-tab ${isActive ? 'active' : ''}`}
            style={{
              flex: '0 0 auto',
              opacity: t.disabled ? 0.4 : 1,
              cursor: t.disabled ? 'not-allowed' : 'pointer',
            }}
            disabled={t.disabled}
            title={t.disabled ? 'Coming soon' : undefined}
            onClick={() => !t.disabled && onSelect(t.id)}
          >
            {t.label}
            {t.count != null && <span className="tab-count">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
