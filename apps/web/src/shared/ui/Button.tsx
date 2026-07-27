import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { classNames } from './class-names.js';

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
          'gj-button',
          `gj-button--${variant}`,
          `gj-button--${size}`,
          className,
        )}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        {...props}
      >
        {pending && <span className="gj-button__spinner" aria-hidden="true" />}
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
        className={classNames('gj-icon-button', className)}
        {...props}
      >
        <span aria-hidden="true">{children}</span>
      </Button>
    );
  },
);
