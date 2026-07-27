import { type CSSProperties, type HTMLAttributes, useState } from 'react';

import { classNames } from './class-names.js';

type AvatarSize = 'small' | 'medium' | 'large' | 'profile';

interface AvatarProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'children'
> {
  name: string;
  src?: string | null;
  size?: AvatarSize;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

function paletteIndex(value: string): number {
  return Array.from(value).reduce((hash, character) => {
    return (hash * 31 + character.codePointAt(0)!) % 6;
  }, 0);
}

const palettes = [
  ['#68204a', '#22cdd1'],
  ['#7617b5', '#ee4f9b'],
  ['#a85b08', '#ff9818'],
  ['#3478d4', '#22cdd1'],
  ['#18864b', '#ff9818'],
  ['#b93838', '#ee4f9b'],
] as const;

export function Avatar({
  name,
  src,
  size = 'medium',
  className,
  style,
  ...props
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [background, ring] = palettes[paletteIndex(name)]!;
  const customProperties = {
    '--gj-avatar-background': background,
    '--gj-avatar-ring': ring,
    ...style,
  } as CSSProperties;

  return (
    <span
      className={classNames(
        'gj-avatar',
        size !== 'medium' && `gj-avatar--${size}`,
        className,
      )}
      style={customProperties}
      aria-label={name}
      role="img"
      {...props}
    >
      {src && !imageFailed ? (
        <img
          src={src}
          alt=""
          onError={() => setImageFailed(true)}
          aria-hidden="true"
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
