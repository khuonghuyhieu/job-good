export type VideoDurationResult =
  | { accepted: true }
  | { accepted: false; failureCode: 'VIDEO_DURATION_EXCEEDED' };

export function validateVideoDuration(
  durationSeconds: number,
  maximumSeconds: number,
): VideoDurationResult {
  return durationSeconds <= maximumSeconds
    ? { accepted: true }
    : { accepted: false, failureCode: 'VIDEO_DURATION_EXCEEDED' };
}

const formatsByMime: Record<string, ReadonlySet<string>> = {
  'video/mp4': new Set(['mov', 'mp4', 'm4a', '3gp', '3g2', 'mj2']),
  'video/quicktime': new Set(['mov', 'mp4', 'm4a', '3gp', '3g2', 'mj2']),
  'video/webm': new Set(['matroska', 'webm']),
} as const;

const supportedVideoCodecs = new Set(['h264', 'hevc', 'vp8', 'vp9', 'av1']);

export function validateVideoMetadata(
  mimeType: string,
  formatNames: string[],
  videoCodecs: string[],
): boolean {
  const formats = formatsByMime[mimeType as keyof typeof formatsByMime];
  return Boolean(
    formats &&
    formatNames.some((format) => formats.has(format)) &&
    videoCodecs.length > 0 &&
    videoCodecs.every((codec) => supportedVideoCodecs.has(codec)),
  );
}
