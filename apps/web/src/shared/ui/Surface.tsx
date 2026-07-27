import {
  createElement,
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type PropsWithChildren,
} from 'react';

import { classNames } from './class-names.js';

const surfaceBase =
  'border border-gj-border bg-gj-surface font-gj text-gj-text';
const badgeTones = {
  neutral: 'gj-badge--neutral bg-gj-surface-subtle text-gj-brand-700',
  primary: 'gj-badge--primary bg-gj-primary-100 text-gj-primary-700',
  success: 'gj-badge--success bg-gj-success-subtle text-gj-success',
  warning: 'gj-badge--warning bg-gj-warning-subtle text-gj-warning',
  danger: 'gj-badge--danger bg-gj-danger-subtle text-gj-danger',
} as const;

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'div' | 'section';
  elevation?: 'card' | 'flat';
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { as = 'div', elevation = 'card', className, children, ...props },
  ref,
) {
  return createElement(
    as,
    {
      ...props,
      ref,
      className: classNames(
        'gj-card rounded-gj-lg p-6 shadow-gj-card',
        surfaceBase,
        elevation === 'flat'
          ? 'gj-card--flat shadow-none'
          : 'gj-card--elevated',
        className,
      ),
    },
    children,
  );
});

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'aside' | 'div' | 'section';
}

export const Panel = forwardRef<HTMLElement, PropsWithChildren<PanelProps>>(
  function Panel({ as = 'section', className, children, ...props }, ref) {
    return createElement(
      as,
      {
        ...props,
        ref,
        className: classNames(
          'gj-panel rounded-gj-md p-5',
          surfaceBase,
          className,
        ),
      },
      children,
    );
  },
);

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
}

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: PropsWithChildren<BadgeProps>) {
  return (
    <span
      className={classNames(
        'gj-badge inline-flex min-h-7 items-center justify-center gap-1 rounded-full px-3 font-gj text-gj-xs font-bold',
        badgeTones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classNames(
        'gj-chip inline-flex min-h-7 cursor-pointer items-center justify-center gap-1 rounded-full border border-gj-control-border bg-gj-surface px-3 font-gj text-gj-xs font-bold text-gj-text-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gj-focus disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:border-gj-primary-600 aria-pressed:bg-gj-primary-600 aria-pressed:text-white',
        className,
      )}
      {...props}
      aria-pressed={selected}
    >
      {children}
    </button>
  );
});
