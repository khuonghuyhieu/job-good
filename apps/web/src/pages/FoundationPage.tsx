export function FoundationPage() {
  return (
    <section className="foundation-card">
      <p className="eyebrow">Phase 1</p>
      <h1>The foundation is ready.</h1>
      <p>
        Good Job’s web, API, worker, database, queue, and object storage
        foundations are configured. Product workflows begin in later phases.
      </p>
      <div className="service-grid" aria-label="Foundation services">
        {['Web', 'API', 'Worker', 'PostgreSQL', 'Redis', 'MinIO'].map(
          (service) => (
            <div className="service-item" key={service}>
              <span className="status-dot" aria-hidden="true" />
              {service}
            </div>
          ),
        )}
      </div>
    </section>
  );
}
