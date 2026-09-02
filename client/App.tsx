import { useEffect, useMemo, useState } from 'react';
import type { Outcome, PortfolioProject } from '../server/portfolio/types.js';

interface PortfolioResponse {
  dataStatus: string;
  projects: PortfolioProject[];
}

type Screen = 'today' | 'portfolio' | 'work' | 'approvals' | 'evidence' | 'money' | 'reviews' | 'parking-lot' | 'system';
type Feedback = { kind: 'success' | 'error'; text: string } | null;

const navigation: Array<{ id: Screen; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'work', label: 'Work' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'money', label: 'Money' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'parking-lot', label: 'Parking Lot' },
  { id: 'system', label: 'System' },
];

const nextActions: Record<string, string> = {
  'outcome-asos-proof': 'Open the internal workflow and capture completion evidence.',
  'outcome-trackmaster-oidc-seam': 'Review the authorization seam with the operator.',
  'outcome-command-slice': 'Run the focused portfolio policy check.',
  'outcome-garage-maintenance': 'Write the next bounded scanner maintenance note.',
};

const milestone = { name: 'Day 5 · Clickable wireframe', deadline: 'September 7, 2026', status: 'ON TRACK' };

function formatDeadline(value: string | null): string {
  if (!value) return 'No deadline set';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

function formatCost(value: number | null): string {
  return value === null ? 'Not recorded' : `$${value.toLocaleString('en-US')} / month`;
}

function outcomeAction(outcome: Outcome): string {
  return nextActions[outcome.id] ?? 'Define the next concrete action for this outcome.';
}

function statusLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

export default function App() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [message, setMessage] = useState('Loading portfolio…');
  const [screen, setScreen] = useState<Screen>('today');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    fetch('/api/portfolio')
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Authorization is not connected.' : 'Portfolio could not be loaded.');
        return response.json() as Promise<PortfolioResponse>;
      })
      .then((data) => { setPortfolio(data); setMessage(''); })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  const projects = portfolio?.projects ?? [];
  const activeOutcomes = useMemo(
    () => projects.flatMap((project) => project.outcomes).filter((outcome) => outcome.status === 'ACTIVE').sort((left, right) => left.priority - right.priority),
    [projects],
  );
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  function navigate(nextScreen: Screen) {
    setScreen(nextScreen);
    setFeedback(null);
  }

  function inspect(projectId: string) {
    setSelectedProjectId(projectId);
    setFeedback(null);
    setScreen('portfolio');
  }

  async function activate(outcome: Outcome) {
    setActivatingId(outcome.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/outcomes/${outcome.id}/activate`, { method: 'POST' });
      const payload = await response.json() as { outcome?: Outcome; message?: string; error?: string };
      if (!response.ok) {
        if (response.status === 409) {
          setFeedback({ kind: 'error', text: 'All three active outcome slots are occupied. Review Today before activating another outcome.' });
        } else {
          setFeedback({ kind: 'error', text: payload.message ?? `Activation failed (${payload.error ?? response.status}).` });
        }
        return;
      }
      if (!payload.outcome) throw new Error('Activation returned no outcome.');
      setPortfolio((current) => current ? {
        ...current,
        projects: current.projects.map((project) => ({
          ...project,
          outcomes: project.outcomes.map((item) => item.id === payload.outcome!.id ? payload.outcome! : item),
        })),
      } : current);
      setSelectedProjectId(null);
      setFeedback({ kind: 'success', text: 'Outcome activated. Today now shows the updated operating state.' });
      setScreen('today');
    } catch {
      setFeedback({ kind: 'error', text: 'Activation could not be completed. Your project context is still open.' });
    } finally {
      setActivatingId(null);
    }
  }

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-lockup"><span className="brand-mark">AC</span><span><span className="eyebrow">AIBRY</span><strong>COMMAND</strong></span></div>
        <p className="sidebar-caption">Operating control plane</p>
        <nav className="nav-list">
          {navigation.map((item) => (
            <button className={`nav-item ${screen === item.id ? 'current' : ''}`} key={item.id} type="button" onClick={() => navigate(item.id)} aria-current={screen === item.id ? 'page' : undefined}>
              <span className="nav-indicator" aria-hidden="true" />{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" />Local wireframe<span className="muted">Seed data only</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><span className="eyebrow">AIBRY COMMAND / {screen === 'parking-lot' ? 'PARKING LOT' : screen.toUpperCase()}</span><h1>{navigation.find((item) => item.id === screen)?.label}</h1></div>
          <div className="milestone-chip"><span className="eyebrow">MILESTONE</span><strong>{milestone.status}</strong><span>{milestone.deadline}</span></div>
        </header>

        <div className="global-feedback" aria-live="polite" role="status">
          {feedback && <div className={`feedback ${feedback.kind}`}><span className="feedback-symbol" aria-hidden="true">{feedback.kind === 'error' ? '!' : '✓'}</span>{feedback.text}</div>}
          {!portfolio && <div className="notice"><span className="status-dot" />{message}</div>}
        </div>

        {screen === 'today' && <Today activeOutcomes={activeOutcomes} dataStatus={portfolio?.dataStatus} onPortfolio={() => navigate('portfolio')} />}
        {screen === 'portfolio' && <PortfolioScreen projects={projects} dataStatus={portfolio?.dataStatus} selectedProject={selectedProject} activatingId={activatingId} onInspect={inspect} onClose={() => setSelectedProjectId(null)} onActivate={activate} onToday={() => navigate('today')} />}
        {screen !== 'today' && screen !== 'portfolio' && <PlaceholderScreen screen={screen} onToday={() => navigate('today')} />}
      </main>
    </div>
  );
}

function Today({ activeOutcomes, dataStatus, onPortfolio }: { activeOutcomes: Outcome[]; dataStatus?: string; onPortfolio: () => void }) {
  return (
    <div className="page-stack">
      <section className="intro-row"><div><p className="section-kicker">OPERATING VIEW</p><h2 className="page-title">What needs closure today?</h2><p className="lede">Three outcomes, their next concrete actions, and the conditions that could stop them.</p></div><span className="seed-label">{dataStatus ? statusLabel(dataStatus) : 'LOADING LOCAL DATA'}</span></section>
      <section className="summary-grid" aria-label="Today summary">
        <div className="summary-card"><span className="eyebrow">ACTIVE OUTCOMES</span><strong className="summary-value blue">{activeOutcomes.length}<small> / 3</small></strong><span className="summary-note">Policy limit enforced server-side</span></div>
        <div className="summary-card"><span className="eyebrow">BLOCKERS</span><strong className="summary-value">0</strong><span className="summary-note">No blockers recorded</span></div>
        <div className="summary-card"><span className="eyebrow">APPROVALS</span><strong className="summary-value">0</strong><span className="summary-note">Nothing waiting for approval</span></div>
        <div className="summary-card"><span className="eyebrow">MONEY PULSE</span><strong className="summary-value">—</strong><span className="summary-note">No spend signal in wireframe</span></div>
      </section>
      <section className="section-block" aria-labelledby="outcomes-heading"><div className="section-heading"><div><p className="section-kicker">CLOSURE QUEUE</p><h2 id="outcomes-heading">Active outcome slots</h2></div><span className="section-count">{activeOutcomes.length} populated · 3 total</span></div><div className="outcome-slots">{[0, 1, 2].map((slot) => { const outcome = activeOutcomes[slot]; return <OutcomeSlot key={outcome?.id ?? `empty-${slot}`} outcome={outcome} slot={slot + 1} />; })}</div></section>
      <section className="lower-grid">
        <div className="info-panel"><div className="section-heading"><div><p className="section-kicker">CURRENT MILESTONE</p><h2>{milestone.name}</h2></div><span className="badge success">{milestone.status}</span></div><div className="milestone-detail"><span>Due {milestone.deadline}</span><span>Wireframe validation in progress</span></div></div>
        <div className="info-panel"><div className="section-heading"><div><p className="section-kicker">NEXT INPUT</p><h2>Portfolio inventory</h2></div></div><p className="panel-copy">Inspect a project to review its purpose and choose a planned outcome for one of the three slots.</p><button className="button secondary" type="button" onClick={onPortfolio}>Open Portfolio <span aria-hidden="true">→</span></button></div>
      </section>
    </div>
  );
}

function OutcomeSlot({ outcome, slot }: { outcome?: Outcome; slot: number }) {
  if (!outcome) return <article className="outcome-slot empty"><div className="slot-number">0{slot}</div><div><span className="eyebrow">AVAILABLE SLOT</span><h3>Nothing active yet</h3><p>Choose a planned outcome from Portfolio.</p></div><span className="empty-mark" aria-hidden="true">＋</span></article>;
  return <article className="outcome-slot"><div className="slot-number">0{slot}</div><div className="slot-content"><div className="slot-meta"><span className="badge active">ACTIVE</span><span>{formatDeadline(outcome.deadline)}</span></div><h3>{outcome.title}</h3><p className="next-action"><span className="eyebrow">NEXT ACTION</span>{outcomeAction(outcome)}</p><p className="success-measure"><span>Success measure</span>{outcome.successMeasure}</p></div></article>;
}

function PortfolioScreen({ projects, dataStatus, selectedProject, activatingId, onInspect, onClose, onActivate, onToday }: { projects: PortfolioProject[]; dataStatus?: string; selectedProject: PortfolioProject | null; activatingId: string | null; onInspect: (id: string) => void; onClose: () => void; onActivate: (outcome: Outcome) => void; onToday: () => void }) {
  return <div className="page-stack"><section className="intro-row"><div><p className="section-kicker">INVENTORY</p><h2 className="page-title">Portfolio</h2><p className="lede">Projects are the operating surface. Inspect one to choose a concrete outcome.</p></div><span className="seed-label">{dataStatus ? statusLabel(dataStatus) : 'LOADING LOCAL DATA'}</span></section><section className="portfolio-layout"><div className="project-list" aria-label="Seeded portfolio projects"><div className="list-header"><span>{projects.length} projects</span><span>Representative inventory</span></div>{projects.map((project) => <ProjectCard key={project.id} project={project} selected={selectedProject?.id === project.id} onInspect={onInspect} />)}</div>{selectedProject ? <ProjectPanel project={selectedProject} activatingId={activatingId} onClose={onClose} onActivate={onActivate} onToday={onToday} /> : <div className="inspect-empty"><span className="empty-mark large" aria-hidden="true">↗</span><p className="section-kicker">PROJECT INSPECTION</p><h2>Choose a project</h2><p>Keep the inventory list in view while reviewing purpose, cost, links, and outcomes.</p></div>}</section></div>;
}

function ProjectCard({ project, selected, onInspect }: { project: PortfolioProject; selected: boolean; onInspect: (id: string) => void }) {
  const outcomeCount = project.outcomes.filter((outcome) => outcome.status === 'ACTIVE').length;
  return <article className={`project-card ${selected ? 'selected' : ''}`}><div className="card-topline"><span className={`classification ${project.classification.toLowerCase()}`}>{project.classification}</span><span className={`status-text ${project.status.toLowerCase()}`}>{project.status}</span></div><h3>{project.name}</h3><p>{project.purpose}</p><dl className="project-facts"><div><dt>Monthly cost</dt><dd>{formatCost(project.monthlyCost)}</dd></div><div><dt>Outcomes</dt><dd>{outcomeCount} active</dd></div></dl><div className="card-footer"><span className="link-state">{project.links.length ? `${project.links.length} link${project.links.length === 1 ? '' : 's'}` : 'No links recorded'}</span><button className="button small" type="button" onClick={() => onInspect(project.id)} aria-label={`Inspect ${project.name}`}>{selected ? 'Inspected' : 'Inspect'} <span aria-hidden="true">→</span></button></div></article>;
}

function ProjectPanel({ project, activatingId, onClose, onActivate, onToday }: { project: PortfolioProject; activatingId: string | null; onClose: () => void; onActivate: (outcome: Outcome) => void; onToday: () => void }) {
  return <aside className="project-panel" aria-label={`${project.name} project details`}><div className="panel-header"><div><p className="section-kicker">PROJECT DETAIL</p><h2>{project.name}</h2></div><button className="close-button" type="button" onClick={onClose} aria-label="Close project details">×</button></div><div className="detail-grid"><div><span className="eyebrow">CLASSIFICATION</span><strong>{project.classification}</strong></div><div><span className="eyebrow">STATUS</span><strong>{project.status}</strong></div><div><span className="eyebrow">MONTHLY COST</span><strong>{formatCost(project.monthlyCost)}</strong></div><div><span className="eyebrow">LINKS</span><strong>{project.links.length ? project.links.map((link) => <a href={link} key={link} target="_blank" rel="noreferrer">Open link</a>) : 'No links recorded'}</strong></div></div><div className="detail-section"><span className="eyebrow">PURPOSE</span><p>{project.purpose}</p></div><div className="detail-section"><div className="section-heading"><div><span className="eyebrow">OUTCOMES</span><h3>Choose one to activate</h3></div><span className="section-count">{project.outcomes.length} planned/active</span></div><div className="detail-outcomes">{project.outcomes.length ? project.outcomes.map((outcome) => <div className="detail-outcome" key={outcome.id}><div><strong>{outcome.title}</strong><span>{formatDeadline(outcome.deadline)} · {outcome.status}</span><small>{outcomeAction(outcome)}</small></div>{outcome.status === 'PLANNED' || outcome.status === 'BLOCKED' ? <button className="button activate" type="button" disabled={activatingId !== null || project.status === 'FROZEN'} onClick={() => onActivate(outcome)}>{activatingId === outcome.id ? 'Activating…' : 'Activate'}</button> : <span className={`badge ${outcome.status.toLowerCase()}`}>{outcome.status}</span>}</div>) : <p className="empty-copy">No outcomes recorded for this project.</p>}</div></div><div className="panel-actions"><button className="button secondary" type="button" onClick={onToday}>Return to Today</button><span className="muted">Activation is checked by the server.</span></div></aside>;
}

function PlaceholderScreen({ screen, onToday }: { screen: Screen; onToday: () => void }) {
  const label = navigation.find((item) => item.id === screen)?.label ?? screen;
  return <section className="placeholder-page"><span className="empty-mark large" aria-hidden="true">◌</span><p className="section-kicker">WIREFRAME PLACEHOLDER</p><h2>{label}</h2><p>This destination is reserved in the operating model. Its backend workflow is intentionally deferred.</p><button className="button secondary" type="button" onClick={onToday}>Return to Today</button></section>;
}
