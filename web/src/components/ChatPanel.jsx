import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { Markdown } from './Markdown';
import { agentInfo, skillInfo } from '../lib/agentLabels';
import { IconCheck, IconChevronLeft, IconCollapse, IconCopy, IconExpand, IconPlug, IconPower, IconSave, IconSend, IconStop, IconTerminal } from './icons';

// Tool calls that tell the pipeline's story (always shown, in plain language);
// everything else is low-level noise gated behind the "Show bash commands" toggle.
const STORY_TOOLS = new Set(['Skill', 'Task', 'Agent']);

/**
 * View for one chat session. Reads the session object from the store and drives
 * it via store actions (send/interrupt/connect/disconnect). Local UI state
 * (tab, tool visibility, expanded agent) is per-mount — the parent keys this
 * component by session id so switching sessions gives a fresh view.
 */
export function ChatPanel({ session, expanded, onToggleExpand }) {
  const chat = useChat();
  const id = session.id;
  const log = session.log || [];
  const busy = session.busy;
  const state = session.state;
  const connected = state === 'open';
  const target = session.target;

  const [input, setInput] = useState('');
  // Default to the clean, non-dev view: the pipeline story (Skill/agent lines)
  // always shows; the low-level bash/file tools stay hidden until toggled on.
  const [showTools, setShowTools] = useState(false);
  const [tab, setTab] = useState('chat'); // 'chat' | 'agents'
  const [expandedAgent, setExpandedAgent] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  // Live "working" timer — a moving number is the clearest signal that the agent
  // is still doing something during long, output-less stretches.
  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return undefined;
    }
    const start = Date.now();
    setElapsed(0);
    const iv = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [busy]);

  const lastResult = useMemo(() => [...log].reverse().find((l) => l.event.kind === 'result')?.event, [log]);

  const tasks = useMemo(() => {
    const map = new Map();
    for (const item of log) {
      const ev = item.event;
      if (ev.kind === 'tool_use' && ev.tools) {
        for (const t of ev.tools) {
          if (t.name === 'Task' || t.name === 'Agent') {
            const info = agentInfo(t.input?.subagent_type);
            map.set(t.id, {
              id: t.id,
              label: t.input?.subagent_type ? info.label : t.input?.description || 'sub-agent',
              verb: t.input?.subagent_type ? info.verb : null,
              type: t.input?.subagent_type || null,
              prompt: t.input?.prompt || null,
              result: null,
              status: 'running',
            });
          }
        }
      }
      if (ev.kind === 'tool_result' && ev.results) {
        for (const r of ev.results) {
          const task = r.toolUseId && map.get(r.toolUseId);
          if (task) {
            task.status = 'done';
            task.result = extractText(r.content);
          }
        }
      }
    }
    return [...map.values()];
  }, [log]);

  function submit() {
    const text = input.trim();
    if (!text) return;
    chat.send(id, text);
    setInput('');
  }

  function quick(cmd) {
    chat.send(id, target ? `${cmd} ${target}` : cmd);
  }

  function saveTranscript() {
    const md = log.map(({ event }) => transcriptLine(event)).filter(Boolean).join('\n\n');
    const blob = new Blob([`# ${session.title || 'chat'}${target ? ` — ${target}` : ''}\n\n${md}\n`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seph-sdlc-chat-${target || session.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      <div className="row wrap" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', rowGap: 8 }}>
        {busy && (
          <span className="working-chip" title="The agent is working">
            <span className="mini-spinner" />
            Working{elapsed ? ` · ${elapsed}s` : '…'}
          </span>
        )}
        <span className="spacer" />
        <button
          className={`btn sm ${showTools ? '' : 'primary'}`}
          onClick={() => setShowTools((v) => !v)}
          title="Show/hide bash & tool activity"
        >
          <IconTerminal width={14} height={14} />
          {showTools ? 'Hide bash commands' : 'Show bash commands'}
        </button>
        {log.length > 0 && (
          <button className="btn sm" onClick={saveTranscript} title="Download chat transcript">
            <IconSave width={14} height={14} /> Save
          </button>
        )}
        {state === 'idle' || state === 'closed' || state === 'error' ? (
          <button className="btn sm primary" onClick={() => chat.connect(id)}>
            <IconPlug width={14} height={14} /> Connect
          </button>
        ) : (
          <>
            <button className="btn sm" onClick={() => chat.interrupt(id)} title="Stop the running agent (interrupt this turn)">
              <IconStop width={14} height={14} /> Stop
            </button>
            <button className="btn sm" onClick={() => chat.disconnect(id)} title="End the session">
              <IconPower width={14} height={14} /> End
            </button>
          </>
        )}
        {onToggleExpand && (
          <button
            className="btn sm"
            onClick={onToggleExpand}
            aria-label={expanded ? 'Collapse chat' : 'Expand chat to full screen'}
            title={expanded ? 'Collapse' : 'Expand to full screen'}
          >
            {expanded ? <IconCollapse width={14} height={14} /> : <IconExpand width={14} height={14} />}
          </button>
        )}
        <button className="close" onClick={chat.close} aria-label="Hide chat" title="Hide (keeps sessions running)" style={{ marginLeft: 2 }}>
          ×
        </button>
      </div>

      <div className="chat-tabs">
        <button className={`chat-tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>
          Chat
        </button>
        <button className={`chat-tab ${tab === 'agents' ? 'active' : ''}`} onClick={() => setTab('agents')}>
          Sub-agents
          {tasks.length > 0 && (
            <span className="tab-count">
              {tasks.filter((t) => t.status === 'done').length}/{tasks.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'chat' ? (
        <>
          {connected && (
            <div className="row wrap" style={{ padding: '10px 16px', gap: 6, borderBottom: '1px solid var(--border)' }}>
              {['/seph-sdlc status', '/seph-sdlc list', '/seph-sdlc continue', '/seph-sdlc sync'].map((c) => (
                <button key={c} className="btn sm mono" onClick={() => quick(c)}>
                  {c.replace('/seph-sdlc ', '/')}
                </button>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
            {log.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>
                {connected
                  ? target
                    ? `Connected. Try "status" or "continue" for ${target}, or type a command.`
                    : 'Connected. Type a /seph-sdlc command to begin.'
                  : 'Connect to start a chat session that runs the real /seph-sdlc pipeline.'}
              </div>
            )}
            {log.map((item, idx) => (
              <ChatMessage
                key={item.id}
                event={item.event}
                count={item.count}
                showTools={showTools}
                running={busy && idx === log.length - 1}
                onAnswer={(a) => chat.send(id, a)}
              />
            ))}
            {busy && (
              <div className="row" style={{ gap: 8, margin: '8px 0', color: 'var(--muted)', fontSize: 13 }}>
                <span className="thinking">
                  <span />
                  <span />
                  <span />
                </span>
                Working…
              </div>
            )}
            <div ref={logEndRef} />
          </div>

          {lastResult && (
            <div className="muted" style={{ padding: '5px 16px', fontSize: 11, borderTop: '1px solid var(--border)' }}>
              {lastResult.costUsd != null && `$${Number(lastResult.costUsd).toFixed(4)} · `}
              {lastResult.numTurns != null && `${lastResult.numTurns} turns`}
              {lastResult.isError && ' · error'}
            </div>
          )}

          <div className="row" style={{ padding: 14, borderTop: '1px solid var(--border)', gap: 8 }}>
            <input
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={connected ? 'Type a message or command…' : 'Connect first'}
              disabled={!connected}
            />
            <button className="btn primary" onClick={submit} disabled={!connected}>
              <IconSend width={15} height={15} /> Send
            </button>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
          {tasks.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>
              No sub-agents yet. When the pipeline spawns parallel agents (e.g. the quality-gate
              validators), they'll appear here with live status.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.map((t) => {
                const open = expandedAgent === t.id;
                return (
                  <div key={t.id} style={{ border: '1px solid var(--border)' }}>
                    <button
                      className={`subagent ${t.status}`}
                      style={{ width: '100%', padding: '11px 12px', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => setExpandedAgent(open ? null : t.id)}
                    >
                      {t.status === 'done' ? <IconCheck width={14} height={14} /> : <span className="mini-spinner" />}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="subagent-label" style={{ fontWeight: 600 }}>{t.label}</div>
                        {t.verb && <div className="muted" style={{ fontSize: 12 }}>{t.verb}</div>}
                        {t.type && <div className="muted mono" style={{ fontSize: 11 }}>{t.type}</div>}
                      </div>
                      <IconChevronLeft
                        width={16}
                        height={16}
                        style={{ color: 'var(--muted)', transform: open ? 'rotate(-90deg)' : 'rotate(180deg)' }}
                      />
                    </button>
                    {open && (
                      <div style={{ padding: '0 12px 12px' }}>
                        {t.prompt && (
                          <>
                            <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 0 4px' }}>Task</div>
                            <pre className="tool-detail">{t.prompt}</pre>
                          </>
                        )}
                        <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '10px 0 4px' }}>Result</div>
                        {t.result ? (
                          <div className="md">
                            <Markdown>{t.result}</Markdown>
                          </div>
                        ) : (
                          <div className="muted" style={{ fontSize: 12 }}>Running… no result yet.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------- helpers ----------------
function extractText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('');
  return '';
}

// Returns a friendly shape for the "story" tools (Skill / Task) — { Icon, title,
// detail } rendered as a plain-language line — and the compact developer shape
// ({ detail, prefix }) for everything else.
function toolSummary(tool) {
  const inp = tool.input || {};
  switch (tool.name) {
    case 'Skill': {
      const { title, detail, Icon } = skillInfo(inp.args);
      return { Icon, title, detail };
    }
    case 'Task':
    case 'Agent': {
      if (inp.subagent_type) {
        const { label, verb, Icon } = agentInfo(inp.subagent_type);
        return { Icon, title: label, detail: verb };
      }
      return { detail: inp.description };
    }
    case 'Bash':
      return { detail: inp.command, prefix: '$ ' };
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'NotebookEdit':
      return { detail: inp.file_path || inp.path };
    case 'Grep':
      return { detail: inp.pattern };
    case 'Glob':
      return { detail: inp.pattern };
    default: {
      let d = '';
      try {
        d = JSON.stringify(inp);
      } catch {
        /* ignore */
      }
      return { detail: d && d !== '{}' ? d : '' };
    }
  }
}

function ToolUse({ tool, running = false }) {
  const { Icon, title, detail, prefix } = toolSummary(tool);

  // Story tool (Skill / agent spawn): a plain-language line with an icon.
  if (title) {
    return (
      <div className="tool-story">
        {Icon && <Icon width={15} height={15} className="tool-story-icon" />}
        <span className="tool-story-title">{title}</span>
        {detail && <span className="tool-story-detail">{detail}</span>}
        {running && <span className="mini-spinner" style={{ marginLeft: 'auto' }} />}
      </div>
    );
  }

  // Low-level tool: the developer-oriented terminal line.
  return (
    <div className="tool">
      <div className="tool-name">
        ⚙ {tool.name}
        {running && (
          <span className="row" style={{ gap: 6, marginLeft: 8, color: 'var(--accent)' }}>
            <span className="mini-spinner" /> running…
          </span>
        )}
      </div>
      {detail && <pre className="tool-detail">{(prefix || '') + detail}</pre>}
    </div>
  );
}

function transcriptLine(event) {
  switch (event.kind) {
    case 'user':
      return event.fromEngine ? '' : `**You:** ${event.text || ''}`;
    case 'assistant':
      return event.text || '';
    case 'tool_use':
      return (event.tools || [])
        .map((t) => {
          const { title, detail, prefix } = toolSummary(t);
          if (title) return `**${title}**${detail ? ` — ${detail}` : ''}`;
          return detail ? `\`${(prefix || '') + detail}\`` : `⚙ ${t.name}`;
        })
        .join('\n');
    case 'tool_result':
      return (event.results || [])
        .map((r) => {
          const text = extractText(r.content);
          return text.trim() ? `\`\`\`\n${text.slice(0, 1000)}\n\`\`\`` : '';
        })
        .filter(Boolean)
        .join('\n');
    case 'error':
      return `> ⚠ ${event.text || ''}`;
    default:
      return '';
  }
}

function AskUserQuestion({ tool, onAnswer }) {
  const questions = tool.input?.questions || [];
  return (
    <div className="zone blue" style={{ margin: '8px 0' }}>
      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{q.question}</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {(q.options || []).map((o, oi) => (
              <button key={oi} className="btn sm" onClick={() => onAnswer(o.label)} title={o.description}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="muted" style={{ fontSize: 11 }}>…or type your own answer below.</div>
    </div>
  );
}

function ChatMessage({ event, count = 1, showTools = true, running = false, onAnswer }) {
  const { kind } = event;

  if (kind === 'user' && event.fromEngine) return null;

  if (kind === 'user') {
    return (
      <Bubble align="right" bg="var(--accent-soft)" border="transparent" color="var(--accent)" copyText={event.text}>
        {event.text}
      </Bubble>
    );
  }
  if (kind === 'assistant' && event.text) {
    return (
      <Bubble align="left" bg="var(--panel-2)" border="var(--border)" copyText={event.text}>
        <Markdown>{event.text}</Markdown>
      </Bubble>
    );
  }
  if (kind === 'tool_use' && event.tools) {
    const askTool = event.tools.find((t) => t.name === 'AskUserQuestion');
    // Story tools (the pipeline command + which agent is running) always show in
    // plain language; low-level bash/file tools only when technical details are on.
    const storyTools = event.tools.filter((t) => STORY_TOOLS.has(t.name));
    const lowLevelTools = event.tools.filter((t) => !STORY_TOOLS.has(t.name) && t.name !== 'AskUserQuestion');
    // Nothing visible (e.g. only hidden bash tools, no text) → render nothing
    // rather than an empty gap.
    if (!event.text && !askTool && !storyTools.length && !(showTools && lowLevelTools.length)) {
      return null;
    }
    return (
      <div style={{ margin: '8px 0' }}>
        {event.text && (
          <Bubble align="left" bg="var(--panel-2)" border="var(--border)" copyText={event.text}>
            <Markdown>{event.text}</Markdown>
          </Bubble>
        )}
        {askTool && <AskUserQuestion tool={askTool} onAnswer={onAnswer} />}
        {storyTools.map((t) => <ToolUse key={t.id} tool={t} running={running} />)}
        {showTools && lowLevelTools.map((t) => <ToolUse key={t.id} tool={t} running={running} />)}
      </div>
    );
  }
  if (kind === 'tool_result' && event.results) {
    if (!showTools) return null;
    return (
      <>
        {event.results.map((r, i) => {
          const text = extractText(r.content);
          if (!text.trim()) return null;
          const truncated = text.length > 800 ? `${text.slice(0, 800)}\n…` : text;
          return (
            <pre key={i} className="tool-detail result">
              {truncated}
            </pre>
          );
        })}
      </>
    );
  }
  if (kind === 'error') {
    return (
      <Bubble align="left" bg="var(--crit-soft)" border="transparent" color="var(--crit)" copyText={event.text}>
        ⚠ {event.text}
      </Bubble>
    );
  }
  if (kind === 'stderr') {
    if (!showTools || !event.text?.trim()) return null;
    return (
      <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)', margin: '2px 0' }}>
        {event.text}
      </div>
    );
  }
  if (kind === 'result') {
    const empty = !event.text || !event.text.trim();
    if (!empty && !event.isError) return null;
    return (
      <div className="muted" style={{ fontSize: 11, textAlign: 'center', margin: '8px 0' }}>
        — {event.isError ? 'error' : 'no output'} —
      </div>
    );
  }
  if (kind === 'system' && event.subtype) {
    const lifecycle = ['init', 'stopped', 'session-closed', 'exit'];
    if (!showTools && !lifecycle.includes(event.subtype)) return null;
    const label =
      event.subtype === 'init' ? 'session started' : event.subtype === 'session-closed' ? 'session ended' : event.subtype;
    return (
      <div className="muted" style={{ fontSize: 11, margin: '6px 0', textAlign: 'center' }}>
        — {label}
        {count > 1 ? ` ×${count}` : ''} —
      </div>
    );
  }
  return null;
}

function Bubble({ children, align, bg, border, color, copyText }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(copyText || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div style={{ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', margin: '6px 0' }}>
      <div
        className="bubble"
        style={{
          position: 'relative',
          maxWidth: '90%',
          minWidth: 0,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 0,
          padding: '9px 13px',
          fontSize: 13,
          color: color || 'var(--text)',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      >
        {children}
        {copyText != null && copyText !== '' && (
          <button className="copy-btn" onClick={copy} title="Copy message" aria-label="Copy message">
            {copied ? <IconCheck width={12} height={12} /> : <IconCopy width={13} height={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
