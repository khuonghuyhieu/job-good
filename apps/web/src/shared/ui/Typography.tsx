import type { HTMLAttributes, PropsWithChildren } from 'react';

import { classNames } from './class-names.js';

type HeadingLevel = 1 | 2 | 3;
const headingSizes = {
  1: 'gj-heading--1 text-[clamp(1.75rem,3vw,2.125rem)]',
  2: 'gj-heading--2 text-gj-2xl',
  3: 'gj-heading--3 text-gj-xl',
} as const;

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
}

export function Heading({
  level = 2,
  className,
  children,
  ...props
}: PropsWithChildren<HeadingProps>) {
  const Component = `h${level}` as const;
  return (
    <Component
      className={classNames(
        'gj-heading m-0 font-gj leading-[1.2] tracking-[-0.025em] text-gj-text',
        headingSizes[level],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  size?: 'small' | 'medium';
  muted?: boolean;
}

export function Text({
  size = 'medium',
  muted = false,
  className,
  children,
  ...props
}: PropsWithChildren<TextProps>) {
  return (
    <p
      className={classNames(
        'gj-text m-0 font-gj leading-[1.55] text-gj-text-secondary',
        size === 'small'
          ? 'gj-text--small text-gj-sm'
          : 'gj-text--medium text-gj-md',
        muted && 'gj-text--muted text-gj-text-muted',
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function Eyebrow({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLParagraphElement>>) {
  return (
    <p
      className={classNames(
        'gj-eyebrow m-0 font-gj text-gj-xs font-extrabold tracking-[0.12em] text-gj-primary-600 uppercase',
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
