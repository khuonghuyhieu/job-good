import { Link } from 'react-router-dom';

export function AppLogo() {
  return (
    <Link
      className="gj-shell-logo inline-flex w-fit items-center gap-3 font-gj font-extrabold text-gj-brand-700 no-underline"
      to="/"
      aria-label="Good Job home"
    >
      <span className="gj-shell-logo__name text-gj-lg">Good Job</span>
    </Link>
  );
}
