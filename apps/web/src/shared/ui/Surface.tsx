import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type PropsWithChildren,
} from 'react';

import { classNames } from './class-names.js';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: 'card' | 'flat';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevation = 'card', className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={classNames(
        'gj-card',
        elevation === 'flat' && 'gj-card--flat',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export const Panel = forwardRef<
  HTMLElement,
  PropsWithChildren<HTMLAttributes<HTMLElement>>
>(function Panel({ className, children, ...props }, ref) {
  return (
    <section ref={ref} className={classNames('gj-panel', className)} {...props}>
      {children}
    </section>
  );
});

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
        'gj-badge',
        tone !== 'neutral' && `gj-badge--${tone}`,
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
      className={classNames('gj-chip', className)}
      aria-pressed={selected}
      {...props}
    >
      {children}
    </button>
  );
});
