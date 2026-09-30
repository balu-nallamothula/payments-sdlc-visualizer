import { NavLink } from 'react-router-dom';
import {
  IconCalendar,
  IconChevronLeft,
  IconDashboard,
  IconDoc,
  IconLayers,
  IconPlug,
  IconStages,
} from './icons';

const SECTIONS = [
  {
    title: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: IconDashboard, end: true }],
  },
  {
    title: 'Workflow',
    items: [
      { to: '/initiatives', label: 'Initiatives', icon: IconLayers },
      { to: '/stages', label: 'Stages Help', icon: IconStages },
    ],
  },
  {
    title: 'Resources',
    items: [
      { to: '/artifacts', label: 'Artifacts', icon: IconDoc },
      { to: '/dev-plan', label: 'Dev Plan', icon: IconCalendar },
      { to: '/integrations', label: 'Integrations', icon: IconPlug },
    ],
  },
];

export function Sidebar({ collapsed, onToggleCollapse }) {
  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="mark">
          <IconLayers width={20} height={20} />
        </span>
        <span className="name">SDLC Visualizer</span>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="section">{section.title}</div>
          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <Icon width={18} height={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      ))}

      <div className="spacer" />

      <button className="collapse-btn" onClick={onToggleCollapse} title={collapsed ? 'Expand' : 'Collapse'}>
        <IconChevronLeft width={18} height={18} style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }} />
        <span>Collapse</span>
      </button>
    </aside>
  );
}
