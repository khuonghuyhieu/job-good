import type { HTMLAttributes, PropsWithChildren } from 'react';

import { classNames } from './class-names.js';

type HeadingLevel = 1 | 2 | 3;

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
      className={classNames('gj-heading', `gj-heading--${level}`, className)}
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
        'gj-text',
        size === 'small' && 'gj-text--small',
        muted && 'gj-text--muted',
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
    <p className={classNames('gj-eyebrow', className)} {...props}>
      {children}
    </p>
  );
}
