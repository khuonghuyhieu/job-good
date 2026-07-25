export const GIVING_POINTS_ALLOWANCE = 200;
export const KUDO_POINTS_MIN = 10;
export const KUDO_POINTS_MAX = 50;
export const VIDEO_MAX_DURATION_SECONDS = 180;

export const supportedEmojiCodes = [
  'celebrate',
  'heart',
  'clap',
  'fire',
] as const;

export type SupportedEmojiCode = (typeof supportedEmojiCodes)[number];
