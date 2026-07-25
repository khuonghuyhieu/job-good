import { Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Good Job home">
          <span className="brand-mark" aria-hidden="true">
            GJ
          </span>
          <span>Good Job</span>
        </a>
        <span className="phase-badge">Foundation</span>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
