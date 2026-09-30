import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useChat } from '../context/ChatContext';
import { GitChanges } from './GitChanges';
import { IconChat, IconMoon, IconSearch, IconSun } from './icons';

export function TopBar() {
  const { theme, toggle } = useTheme();
  const chat = useChat();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  function onSearch(e) {
    if (e.key === 'Enter') {
      navigate(`/initiatives?q=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <header className="topbar">
      <div className="tabs">
        <NavLink to="/initiatives" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
          Initiatives
        </NavLink>
        <NavLink to="/stages" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
          Stages Help
        </NavLink>
      </div>

      <div className="search">
        <IconSearch width={16} height={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onSearch}
          placeholder="Search initiatives, stages, or files…"
        />
      </div>

      <GitChanges />
      <button className="iconbtn" onClick={toggle} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
        {theme === 'light' ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
      </button>
      <button className="iconbtn" title="Chat / Run" onClick={chat.toggle}>
        <IconChat width={18} height={18} />
      </button>
    </header>
  );
}
