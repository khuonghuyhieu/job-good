// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AttachmentPicker } from './AttachmentPicker.js';
import { MediaAttachmentView } from './MediaAttachmentView.js';

const mediaApi = vi.hoisted(() => ({
  completeMedia: vi.fn(),
  createUploadIntent: vi.fn(),
  getMediaStatus: vi.fn(),
  removeMedia: vi.fn(),
  uploadDirect: vi.fn(),
}));

vi.mock('./api.js', () => ({
  ...mediaApi,
  mediaQueryKey: (id: string) => ['media', id],
}));

function attachment(status: 'uploading' | 'processing' | 'ready' | 'failed') {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    ownerType: 'kudo' as const,
    ownerId: null,
    mediaType: 'image' as const,
    status,
    mimeType: 'image/png',
    originalName: 'proof.png',
    sizeBytes: 8,
    durationSeconds: null,
    contentUrl: status === 'ready' ? 'https://objects.test/proof.png' : null,
    failureCode: status === 'failed' ? 'MEDIA_PROCESSING_FAILED' : null,
  };
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

describe('Phase 7 media UI', () => {
  it('uploads the file directly, reports progress, and exposes only the server attachment ID', async () => {
    mediaApi.createUploadIntent.mockResolvedValue({
      attachment: attachment('uploading'),
      upload: {
        method: 'PUT',
        url: 'https://objects.test/upload',
        headers: { 'content-type': 'image/png' },
        expiresAt: '2026-07-27T00:00:00.000Z',
      },
    });
    mediaApi.uploadDirect.mockImplementation(
      async (
        _upload: unknown,
        _file: unknown,
        progress: (value: number) => void,
      ) => {
        progress(50);
      },
    );
    mediaApi.completeMedia.mockResolvedValue({
      attachment: attachment('ready'),
    });
    const onChange = vi.fn();

    render(
      <AttachmentPicker
        attachmentIds={[]}
        disabled={false}
        onChange={onChange}
      />,
    );
    await userEvent.upload(
      screen.getByLabelText('Add image or video'),
      new File(['png-data'], 'proof.png', { type: 'image/png' }),
    );

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        '70000000-0000-4000-8000-000000000001',
      ]),
    );
    expect(mediaApi.uploadDirect).toHaveBeenCalledOnce();
    expect(await screen.findByText('Ready')).toBeInTheDocument();
  });

  it('never renders processing media as ready content', async () => {
    mediaApi.getMediaStatus.mockResolvedValue({
      attachment: {
        ...attachment('processing'),
        mediaType: 'video',
        mimeType: 'video/mp4',
        originalName: 'clip.mp4',
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MediaAttachmentView attachmentId="70000000-0000-4000-8000-000000000001" />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText('Media is processing. It is not ready yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
  });

  it('shows a recoverable error when processing-status polling fails', async () => {
    const processing = {
      ...attachment('processing'),
      mediaType: 'video' as const,
      mimeType: 'video/mp4' as const,
      originalName: 'clip.mp4',
    };
    mediaApi.createUploadIntent.mockResolvedValue({
      attachment: { ...processing, status: 'uploading' },
      upload: {
        method: 'PUT',
        url: 'https://objects.test/upload',
        headers: { 'content-type': 'video/mp4' },
        expiresAt: '2026-07-27T00:00:00.000Z',
      },
    });
    mediaApi.uploadDirect.mockResolvedValue(undefined);
    mediaApi.completeMedia.mockResolvedValue({ attachment: processing });
    mediaApi.getMediaStatus.mockRejectedValue(new Error('temporary'));

    render(
      <AttachmentPicker
        attachmentIds={[]}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    await userEvent.upload(
      screen.getByLabelText('Add image or video'),
      new File(['video'], 'clip.mp4', { type: 'video/mp4' }),
    );
    expect(await screen.findByText('Video processing…')).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 2100));
    expect(
      await screen.findByText(
        'Processing status is temporarily unavailable. Retrying…',
      ),
    ).toBeInTheDocument();
  });
});
