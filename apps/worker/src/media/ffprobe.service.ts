import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Injectable } from '@nestjs/common';

const execute = promisify(execFile);

export type VideoProbe = {
  durationSeconds: number;
  formatNames: string[];
  videoCodecs: string[];
};

@Injectable()
export class FfprobeService {
  async probeVideo(url: string): Promise<VideoProbe> {
    const { stdout } = await execute('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=format_name,duration:stream=codec_type,codec_name',
      '-of',
      'json',
      url,
    ]);
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string; format_name?: string };
      streams?: Array<{ codec_type?: string; codec_name?: string }>;
    };
    const duration = Number(parsed.format?.duration);
    if (!Number.isFinite(duration) || duration < 0) {
      throw new Error('ffprobe returned an invalid duration.');
    }
    return {
      durationSeconds: duration,
      formatNames: (parsed.format?.format_name ?? '')
        .split(',')
        .filter(Boolean),
      videoCodecs: (parsed.streams ?? [])
        .filter((stream) => stream.codec_type === 'video')
        .flatMap((stream) => (stream.codec_name ? [stream.codec_name] : [])),
    };
  }

  async ping(): Promise<void> {
    await execute('ffprobe', ['-version']);
  }
}
