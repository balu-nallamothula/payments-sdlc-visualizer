import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { GitProvider } from './context/GitContext';
import { CurrentInitiativeProvider } from './context/CurrentInitiativeContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ChatPanel } from './components/ChatPanel';
import { ChatRail } from './components/ChatRail';
import { IconChat } from './components/icons';
import { DashboardPage } from './pages/Dashboard';
import { InitiativesPage } from './pages/Initiatives';
import { InitiativeRoute } from './pages/InitiativeRoute';
import { StagesPage } from './pages/Stages';
import { IntegrationsPage } from './pages/Integrations';
import { ArtifactsPage } from './pages/Artifacts';
import { DevPlanPage } from './pages/DevPlan';

function ChatDock() {
  const chat = useChat();
  const [expanded, setExpanded] = useState(false);
  const active = chat.sessions.find((s) => s.id === chat.activeId) || null;
  // Stay mounted even when hidden so sessions (and running agents) keep going —
  // "Hide" just visually collapses it; "End" stops a session.
  return (
    <aside className={`chat-dock ${expanded ? 'expanded' : ''}`} style={{ display: chat.visible ? 'flex' : 'none' }}>
      <ChatRail />
      <div className="chat-main">
        {active ? (
          <ChatPanel key={active.id} session={active} expanded={expanded} onToggleExpand={() => setExpanded((v) => !v)} />
        ) : (
          <div className="chat-empty">
            <div className="muted" style={{ marginBottom: 12 }}>No open chats.</div>
            <button className="btn primary" onClick={() => chat.newChat()}>
              <IconChat width={15} height={15} /> Start a chat
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`layout ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <div className="main">
        <TopBar />
        <div className="content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/initiatives" element={<InitiativesPage />} />
            <Route path="/initiatives/*" element={<InitiativeRoute />} />
            <Route path="/stages" element={<StagesPage />} />
            <Route path="/artifacts" element={<ArtifactsPage />} />
            <Route path="/dev-plan" element={<DevPlanPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
          </Routes>
        </div>
      </div>
      <ChatDock />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <GitProvider>
        <ChatProvider>
          <CurrentInitiativeProvider>
            <Shell />
          </CurrentInitiativeProvider>
        </ChatProvider>
      </GitProvider>
    </ThemeProvider>
  );
}
