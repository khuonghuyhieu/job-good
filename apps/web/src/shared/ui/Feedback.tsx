import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { Button } from './Button.js';
import { classNames } from './class-names.js';

export function Spinner({
  label = 'Loading',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" aria-label={label}>
      <span
        className={classNames('gj-spinner', className)}
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
      className={classNames('gj-skeleton', className)}
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
  onAction?: () => void;
}

export function LoadingState({
  title = 'Loading…',
  description,
}: Partial<Pick<FeedbackProps, 'title' | 'description'>>) {
  return (
    <div className="gj-feedback" role="status" aria-live="polite">
      <Spinner label={title} />
      <p className="gj-feedback__title">{title}</p>
      {description && <p className="gj-feedback__body">{description}</p>}
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
    <div className="gj-feedback">
      {icon && <span aria-hidden="true">{icon}</span>}
      <p className="gj-feedback__title">{title}</p>
      {description && <p className="gj-feedback__body">{description}</p>}
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
  onAction,
}: FeedbackProps) {
  return (
    <div className="gj-feedback gj-feedback--error" role="alert">
      <p className="gj-feedback__title">{title}</p>
      {description && <p className="gj-feedback__body">{description}</p>}
      {onAction && (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
