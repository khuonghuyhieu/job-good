import { Link } from 'react-router-dom';

export function AppLogo() {
  return (
    <Link
      className="gj-shell-logo inline-flex w-fit items-center gap-3 font-gj font-extrabold text-gj-brand-700 no-underline"
      to="/"
      aria-label="Good Job home"
    >
      <span
        className="gj-shell-logo__mark relative grid size-11 place-items-center overflow-hidden rounded-[0.9rem] bg-linear-to-br from-gj-primary-500 to-gj-brand-600 text-[0.72rem] leading-[0.75] text-white shadow-gj-logo max-mobile:size-10"
        aria-hidden="true"
      >
        <span className="-translate-x-[0.2rem] translate-y-[0.1rem]">G</span>
        <span className="translate-x-[0.2rem] -translate-y-[0.1rem]">J</span>
      </span>
      <span className="gj-shell-logo__name text-gj-lg">Good Job</span>
    </Link>
  );
}
