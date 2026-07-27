import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { Button } from './Button.js';
import { classNames } from './class-names.js';

const spinnerClass =
  'gj-spinner inline-block size-[1em] shrink-0 animate-gj-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none';
const feedbackClass =
  'gj-feedback grid justify-items-start gap-3 rounded-gj-md bg-gj-surface-subtle p-4 font-gj text-gj-text-secondary';
export function Spinner({
  label = 'Loading',
  className,
  decorative = false,
}: {
  label?: string;
  className?: string;
  decorative?: boolean;
}) {
  if (decorative) {
    return (
      <span
        className={classNames(spinnerClass, className)}
        aria-hidden="true"
      />
    );
  }
  return (
    <span role="status" aria-label={label}>
      <span
        className={classNames(spinnerClass, className)}
        aria-hidden="true"
      />
    </span>
  );
}

interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
}

export function Skeleton({
  width,
  height,
  className,
  style,
  ...props
}: SkeletonProps) {
  return (
    <span
      className={classNames(
        'gj-skeleton block min-h-4 overflow-hidden rounded-gj-sm bg-gj-border bg-gj-skeleton bg-[length:200%_100%] animate-gj-skeleton motion-reduce:animate-none',
        className,
      )}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...props}
    />
  );
}

interface FeedbackProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  actionPending?: boolean;
  onAction?: () => void;
}

export function LoadingState({
  title = 'Loading…',
  description,
}: Partial<Pick<FeedbackProps, 'title' | 'description'>>) {
  return (
    <div
      className={feedbackClass}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <Spinner label={title} decorative />
      <p className="gj-feedback__title m-0 font-bold text-gj-text">{title}</p>
      {description && <p className="gj-feedback__body m-0">{description}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: FeedbackProps) {
  return (
    <div className={feedbackClass}>
      {icon && <span aria-hidden="true">{icon}</span>}
      <p className="gj-feedback__title m-0 font-bold text-gj-text">{title}</p>
      {description && <p className="gj-feedback__body m-0">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  actionLabel = 'Try again',
  actionPending = false,
  onAction,
}: FeedbackProps) {
  return (
    <div
      className={classNames(
        feedbackClass,
        'gj-feedback--error bg-gj-danger-subtle text-gj-danger',
      )}
      role="alert"
    >
      <p className="gj-feedback__title m-0 font-bold text-gj-text">{title}</p>
      {description && <p className="gj-feedback__body m-0">{description}</p>}
      {onAction && (
        <Button
          variant="secondary"
          pending={actionPending}
          pendingLabel="Retrying…"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
