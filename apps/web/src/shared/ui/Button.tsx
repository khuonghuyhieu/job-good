import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { classNames } from './class-names.js';

const buttonBase =
  'gj-button inline-flex min-h-11 items-center justify-center gap-2 rounded-gj-sm border border-transparent px-4 font-gj text-gj-sm font-bold leading-none transition duration-150 ease-out hover:not-disabled:-translate-y-px focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gj-focus disabled:cursor-not-allowed disabled:opacity-60';
const buttonVariants = {
  primary:
    'gj-button--primary bg-gj-primary-600 text-white hover:not-disabled:bg-gj-primary-700',
  secondary:
    'gj-button--secondary border-gj-control-border bg-gj-surface text-gj-brand-700',
  ghost: 'gj-button--ghost bg-transparent text-gj-primary-700',
  danger: 'gj-button--danger bg-gj-danger text-white',
} as const;
const buttonSizes = {
  small: 'gj-button--small min-h-9 px-3',
  medium: 'gj-button--medium',
  large: 'gj-button--large min-h-13 px-6 text-gj-md',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  pending?: boolean;
  pendingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'medium',
      pending = false,
      pendingLabel = 'Working…',
      disabled,
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={classNames(
          buttonBase,
          buttonVariants[variant],
          buttonSizes[size],
          className,
        )}
        {...props}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
      >
        {pending && (
          <span
            className="gj-button__spinner size-[1em] shrink-0 animate-gj-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        <span>{pending ? pendingLabel : children}</span>
      </button>
    );
  },
);

export interface IconButtonProps extends Omit<
  ButtonProps,
  'children' | 'size'
> {
  'aria-label': string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ className, children, ...props }, ref) {
    return (
      <Button
        ref={ref}
        className={classNames(
          'gj-icon-button w-11 rounded-full px-0',
          className,
        )}
        {...props}
      >
        <span aria-hidden="true">{children}</span>
      </Button>
    );
  },
);
