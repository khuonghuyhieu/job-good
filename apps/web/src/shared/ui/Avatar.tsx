import { type HTMLAttributes, useState } from 'react';

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
  'bg-gj-avatar-1 border-gj-avatar-ring-1',
  'bg-gj-avatar-2 border-gj-avatar-ring-2',
  'bg-gj-avatar-3 border-gj-avatar-ring-3',
  'bg-gj-avatar-4 border-gj-avatar-ring-4',
  'bg-gj-avatar-5 border-gj-avatar-ring-5',
  'bg-gj-avatar-6 border-gj-avatar-ring-6',
] as const;
const avatarSizes = {
  small: 'gj-avatar--small size-8 text-[0.68rem]',
  medium: 'gj-avatar--medium size-10 text-[0.85rem]',
  large: 'gj-avatar--large size-14 text-[1.19rem]',
  profile: 'gj-avatar--profile size-24 text-[2.04rem]',
} as const;

export function Avatar({
  name,
  src,
  size = 'medium',
  className,
  style,
  ...props
}: AvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const palette = palettes[paletteIndex(name)]!;

  return (
    <span
      className={classNames(
        'gj-avatar inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 font-gj font-extrabold text-white uppercase [&_img]:size-full [&_img]:object-cover',
        palette,
        avatarSizes[size],
        className,
      )}
      style={style}
      aria-label={name}
      role="img"
      {...props}
    >
      {src && src !== failedSource ? (
        <img
          src={src}
          alt=""
          onError={() => setFailedSource(src)}
          aria-hidden="true"
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
