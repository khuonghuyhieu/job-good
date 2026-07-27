import { describe, expect, it, vi } from 'vitest';

import { FfprobeService } from './ffprobe.service.js';

describe('FfprobeService resource boundaries', () => {
  it('bounds probe duration and output while parsing video metadata', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        format: { duration: '12.5', format_name: 'mov,mp4' },
        streams: [{ codec_type: 'video', codec_name: 'h264' }],
      }),
    });
    const service = new FfprobeService(1234, run);

    await expect(
      service.probeVideo('https://storage.invalid/signed'),
    ).resolves.toEqual({
      durationSeconds: 12.5,
      formatNames: ['mov', 'mp4'],
      videoCodecs: ['h264'],
    });
    expect(run).toHaveBeenCalledWith(
      'ffprobe',
      expect.arrayContaining(['https://storage.invalid/signed']),
      { timeout: 1234, maxBuffer: 256 * 1024, windowsHide: true },
    );
  });

  it('uses a short timeout for readiness probes', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: 'ffprobe version' });
    await new FfprobeService(30_000, run).ping();
    expect(run).toHaveBeenCalledWith('ffprobe', ['-version'], {
      timeout: 5000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
  });
});
