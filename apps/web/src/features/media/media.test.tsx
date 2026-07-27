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

function attachment(
  status: 'uploading' | 'processing' | 'ready' | 'failed',
  id = '70000000-0000-4000-8000-000000000001',
) {
  return {
    id,
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

  it('retains every attachment ID when multiple uploads complete concurrently', async () => {
    const firstId = '70000000-0000-4000-8000-000000000001';
    const secondId = '70000000-0000-4000-8000-000000000002';
    let intent = 0;
    mediaApi.createUploadIntent.mockImplementation(async () => {
      const id = intent++ === 0 ? firstId : secondId;
      return {
        attachment: attachment('uploading', id),
        upload: {
          method: 'PUT',
          url: `https://objects.test/${id}`,
          headers: { 'content-type': 'image/png' },
          expiresAt: '2026-07-27T00:00:00.000Z',
        },
      };
    });
    mediaApi.uploadDirect.mockResolvedValue(undefined);
    mediaApi.completeMedia.mockImplementation(async (id: string) => ({
      attachment: attachment('ready', id),
    }));
    const onChange = vi.fn();

    render(
      <AttachmentPicker
        attachmentIds={[]}
        disabled={false}
        onChange={onChange}
      />,
    );
    await userEvent.upload(screen.getByLabelText('Add image or video'), [
      new File(['first'], 'first.png', { type: 'image/png' }),
      new File(['second'], 'second.png', { type: 'image/png' }),
    ]);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([firstId, secondId]),
    );
    expect(await screen.findAllByText('Ready')).toHaveLength(2);
  });

  it('shows terminal file validation without offering a futile retry', async () => {
    render(
      <AttachmentPicker
        attachmentIds={[]}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    const picker = screen.getByLabelText('Add image or video');
    await userEvent.upload(
      picker,
      new File(['plain'], 'notes.txt', { type: 'text/plain' }),
      { applyAccept: false },
    );

    expect(await screen.findByText(/Unsupported file type/u)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Retry upload' }),
    ).not.toBeInTheDocument();
    expect(mediaApi.createUploadIntent).not.toHaveBeenCalled();
    expect(picker.parentElement).toHaveClass('focus-within:outline-3');
  });

  it('announces when the five-file limit truncates a selection', async () => {
    mediaApi.createUploadIntent.mockRejectedValue(new Error('offline'));
    render(
      <AttachmentPicker
        attachmentIds={[]}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    const files = Array.from(
      { length: 6 },
      (_, index) =>
        new File([String(index)], `proof-${index}.png`, { type: 'image/png' }),
    );
    await userEvent.upload(screen.getByLabelText('Add image or video'), files);

    expect(
      await screen.findByText(
        'Only 5 files were added. A Kudo can include up to five files.',
      ),
    ).toHaveAttribute('role', 'status');
    expect(
      screen.getAllByRole('button', { name: /Remove proof-/u }),
    ).toHaveLength(5);
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

  it('distinguishes an incomplete upload from media processing', async () => {
    mediaApi.getMediaStatus.mockResolvedValue({
      attachment: attachment('uploading'),
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
      await screen.findByText('Media upload is not complete yet.'),
    ).toBeVisible();
    expect(
      screen.queryByText('Media is processing. It is not ready yet.'),
    ).not.toBeInTheDocument();
  });

  it('renders a failed attachment as an explicit terminal state', async () => {
    mediaApi.getMediaStatus.mockResolvedValue({
      attachment: attachment('failed'),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MediaAttachmentView attachmentId="70000000-0000-4000-8000-000000000001" />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Media processing failed.',
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders ready image media from the server content URL', async () => {
    mediaApi.getMediaStatus.mockResolvedValue({
      attachment: attachment('ready'),
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
      await screen.findByRole('img', { name: 'proof.png' }),
    ).toHaveAttribute('src', 'https://objects.test/proof.png');
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
