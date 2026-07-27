import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Injectable } from '@nestjs/common';

const execute = promisify(execFile);
type ExecuteCommand = (
  file: string,
  arguments_: string[],
  options: { timeout: number; maxBuffer: number; windowsHide: boolean },
) => Promise<{ stdout: string }>;

const executeCommand: ExecuteCommand = async (file, arguments_, options) => {
  const result = await execute(file, arguments_, options);
  return { stdout: String(result.stdout) };
};

export type VideoProbe = {
  durationSeconds: number;
  formatNames: string[];
  videoCodecs: string[];
};

@Injectable()
export class FfprobeService {
  constructor(
    private readonly timeoutMs = 30_000,
    private readonly run: ExecuteCommand = executeCommand,
  ) {}

  async probeVideo(url: string): Promise<VideoProbe> {
    const { stdout } = await this.run(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=format_name,duration:stream=codec_type,codec_name',
        '-of',
        'json',
        url,
      ],
      {
        timeout: this.timeoutMs,
        maxBuffer: 256 * 1024,
        windowsHide: true,
      },
    );
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
    await this.run('ffprobe', ['-version'], {
      timeout: Math.min(this.timeoutMs, 5000),
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
  }
}
