import { NavLink } from 'react-router-dom';

import { AppIcon } from '../shared/ui/index.js';

const destinations = [
  { to: '/', label: 'Home', icon: 'home', end: true, iconClass: '' },
  {
    to: '/rewards',
    label: 'Rewards',
    icon: 'rewards',
    end: false,
    iconClass: 'text-gj-orange',
  },
  {
    to: '/wallet',
    label: 'Wallet',
    icon: 'wallet',
    end: false,
    iconClass: 'text-gj-cyan',
  },
] as const;
const navigationPlacement = {
  desktop:
    'gj-primary-nav--desktop flex items-stretch justify-center gap-2 max-mobile:hidden',
  mobile:
    'gj-primary-nav--mobile fixed inset-x-0 bottom-0 z-20 hidden min-h-18 grid-cols-3 items-center gap-0 border-t border-gj-border bg-white/97 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-gj-mobile-nav max-mobile:grid',
} as const;
const linkBase =
  'gj-primary-nav__link relative grid min-h-17 min-w-22 place-content-center place-items-center gap-1 rounded-gj-md font-gj text-gj-xs font-bold text-gj-text-secondary no-underline transition duration-150 hover:bg-gj-primary-100 hover:text-gj-primary-700 max-tablet:min-w-16 max-mobile:min-h-15 max-mobile:min-w-0';
const linkState = {
  active:
    "gj-primary-nav__link--active text-gj-brand-700 after:absolute after:inset-x-4 after:-bottom-3 after:h-[0.2rem] after:rounded-full after:bg-gj-primary-600 after:content-[''] max-mobile:after:inset-x-[28%] max-mobile:after:top-0 max-mobile:after:bottom-auto",
  inactive: '',
} as const;

export function PrimaryNavigation({
  placement,
}: {
  placement: 'desktop' | 'mobile';
}) {
  return (
    <nav
      className={`gj-primary-nav ${navigationPlacement[placement]}`}
      aria-label={
        placement === 'mobile' ? 'Mobile navigation' : 'Primary navigation'
      }
    >
      {destinations.map((destination) => (
        <NavLink
          key={destination.to}
          to={destination.to}
          end={destination.end}
          aria-label={destination.label}
          className={({ isActive }) =>
            `${linkBase} ${isActive ? linkState.active : linkState.inactive}`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`gj-primary-nav__icon size-6 [&_svg]:size-6 ${destination.iconClass}`}
              >
                <AppIcon name={destination.icon} />
              </span>
              <span className="gj-primary-nav__label max-tablet:hidden max-mobile:inline">
                {destination.label}
              </span>
              {isActive && (
                <span className="gj-visually-hidden absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]">
                  Current page
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
