import { useEffect, useState } from 'react';
import type { PortfolioProject } from '../server/portfolio/types.js';

interface PortfolioResponse {
  dataStatus: string;
  projects: PortfolioProject[];
}

export default function App() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [message, setMessage] = useState('Loading portfolio…');

  useEffect(() => {
    fetch('/api/portfolio')
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Authorization is not connected.' : 'Portfolio could not be loaded.');
        return response.json() as Promise<PortfolioResponse>;
      })
      .then((data) => { setPortfolio(data); setMessage(''); })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  const activeCount = portfolio?.projects.flatMap((project) => project.outcomes).filter((outcome) => outcome.status === 'ACTIVE').length ?? 0;

  return (
    <main className="shell">
      <header className="topbar">
        <div><span className="eyebrow">AIBRY COMMAND</span><h1>Portfolio</h1></div>
        <div className="policy"><span>ACTIVE OUTCOMES</span><strong>{activeCount} / 3</strong></div>
      </header>
      <section className="notice" aria-live="polite">
        <span className="status-dot" />
        {portfolio ? `Data status: ${portfolio.dataStatus.replaceAll('_', ' ').toLowerCase()}.` : message}
      </section>
      {portfolio && (
        <section className="grid" aria-label="Portfolio projects">
          {portfolio.projects.map((project) => (
            <article className="card" key={project.id}>
              <div className="card-heading"><span className="classification">{project.classification}</span><span className="project-status">{project.status}</span></div>
              <h2>{project.name}</h2>
              <p>{project.purpose}</p>
              <div className="outcomes">
                {project.outcomes.map((outcome) => <div className="outcome" key={outcome.id}><span>{outcome.title}</span><span className={`outcome-status ${outcome.status.toLowerCase()}`}>{outcome.status}</span></div>)}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
