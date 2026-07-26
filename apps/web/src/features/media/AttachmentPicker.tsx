import { useEffect, useRef, useState } from 'react';
import type { MediaAttachmentDto } from '@good-job/contracts';

import {
  completeMedia,
  createUploadIntent,
  getMediaStatus,
  removeMedia,
  uploadDirect,
} from './api.js';

const maximumFiles = 5;
const imageLimit = 10 * 1024 * 1024;
const videoLimit = 200 * 1024 * 1024;
const supported = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

type UploadItem = {
  localId: string;
  file: File;
  attachment: MediaAttachmentDto | null;
  progress: number;
  state: 'uploading' | 'processing' | 'ready' | 'failed';
  error?: string | undefined;
  statusError?: string | undefined;
};

export function AttachmentPicker({
  attachmentIds,
  disabled,
  onChange,
}: {
  attachmentIds: string[];
  disabled: boolean;
  onChange: (attachmentIds: string[]) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const mounted = useRef(true);
  const previousAttachmentIds = useRef(attachmentIds);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (
      previousAttachmentIds.current.length > 0 &&
      attachmentIds.length === 0
    ) {
      setItems([]);
    }
    previousAttachmentIds.current = attachmentIds;
  }, [attachmentIds]);

  useEffect(() => {
    const processing = items.filter(
      (item) => item.attachment?.status === 'processing',
    );
    if (!processing.length) return;
    const timer = setInterval(() => {
      for (const item of processing) {
        void getMediaStatus(item.attachment!.id)
          .then(({ attachment }) => {
            if (!mounted.current) return;
            setItems((current) =>
              current.map((candidate) =>
                candidate.localId === item.localId
                  ? {
                      ...candidate,
                      attachment,
                      state: attachment.status as UploadItem['state'],
                      statusError: undefined,
                      ...(attachment.status === 'failed'
                        ? { error: 'Video processing failed.' }
                        : {}),
                    }
                  : candidate,
              ),
            );
          })
          .catch(() => {
            if (!mounted.current) return;
            setItems((current) =>
              current.map((candidate) =>
                candidate.localId === item.localId
                  ? {
                      ...candidate,
                      statusError:
                        'Processing status is temporarily unavailable. Retrying…',
                    }
                  : candidate,
              ),
            );
          });
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [items]);

  async function upload(
    item: UploadItem,
    existingAttachmentIds = attachmentIds,
  ): Promise<void> {
    try {
      const mediaType = item.file.type.startsWith('image/') ? 'image' : 'video';
      const intent = await createUploadIntent({
        ownerType: 'kudo',
        mediaType,
        mimeType: item.file.type,
        originalName: item.file.name,
        sizeBytes: item.file.size,
      });
      setItems((current) =>
        current.map((candidate) =>
          candidate.localId === item.localId
            ? { ...candidate, attachment: intent.attachment }
            : candidate,
        ),
      );
      await uploadDirect(intent.upload, item.file, (progress) =>
        setItems((current) =>
          current.map((candidate) =>
            candidate.localId === item.localId
              ? { ...candidate, progress }
              : candidate,
          ),
        ),
      );
      const completed = await completeMedia(intent.attachment.id);
      if (!mounted.current) return;
      setItems((current) =>
        current.map((candidate) =>
          candidate.localId === item.localId
            ? {
                ...candidate,
                progress: 100,
                attachment: completed.attachment,
                state: completed.attachment.status as UploadItem['state'],
                error: undefined,
              }
            : candidate,
        ),
      );
      onChange([...existingAttachmentIds, completed.attachment.id]);
    } catch {
      if (!mounted.current) return;
      setItems((current) =>
        current.map((candidate) =>
          candidate.localId === item.localId
            ? {
                ...candidate,
                state: 'failed',
                error: 'Upload failed. Your Kudo draft is preserved.',
              }
            : candidate,
        ),
      );
    }
  }

  function select(files: FileList | null): void {
    if (!files) return;
    const available = maximumFiles - items.length;
    for (const file of Array.from(files).slice(0, available)) {
      const limit = file.type.startsWith('image/') ? imageLimit : videoLimit;
      const item: UploadItem = {
        localId: crypto.randomUUID(),
        file,
        attachment: null,
        progress: 0,
        state: 'uploading',
        ...(!supported.has(file.type) || file.size > limit
          ? {
              state: 'failed' as const,
              error: 'Unsupported type or file size.',
            }
          : {}),
      };
      setItems((current) => [...current, item]);
      if (!item.error) void upload(item);
    }
  }

  async function remove(item: UploadItem): Promise<void> {
    if (item.attachment && !item.attachment.ownerId) {
      await removeMedia(item.attachment.id).catch(() => undefined);
    }
    setItems((current) =>
      current.filter((candidate) => candidate.localId !== item.localId),
    );
    if (item.attachment) {
      onChange(attachmentIds.filter((id) => id !== item.attachment!.id));
    }
  }

  return (
    <fieldset disabled={disabled}>
      <legend>Optional image or video</legend>
      <input
        aria-label="Add image or video"
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        multiple
        disabled={disabled || items.length >= maximumFiles}
        onChange={(event) => select(event.target.files)}
      />
      <ul>
        {items.map((item) => (
          <li key={item.localId}>
            <span>{item.file.name}</span>
            {item.state === 'uploading' && (
              <progress value={item.progress} max={100}>
                {item.progress}%
              </progress>
            )}
            {item.state === 'processing' && (
              <span role="status">Video processing…</span>
            )}
            {item.statusError && <span role="alert">{item.statusError}</span>}
            {item.state === 'ready' && <span role="status">Ready</span>}
            {item.error && <span role="alert">{item.error}</span>}
            {item.state === 'failed' && (
              <button
                type="button"
                onClick={() => {
                  const previousId = item.attachment?.id;
                  const remainingIds = previousId
                    ? attachmentIds.filter((id) => id !== previousId)
                    : attachmentIds;
                  void (async () => {
                    if (item.attachment && !item.attachment.ownerId) {
                      await removeMedia(item.attachment.id).catch(
                        () => undefined,
                      );
                    }
                    onChange(remainingIds);
                    const retryItem = {
                      ...item,
                      attachment: null,
                      progress: 0,
                      state: 'uploading' as const,
                      error: undefined,
                    };
                    setItems((current) =>
                      current.map((candidate) =>
                        candidate.localId === item.localId
                          ? retryItem
                          : candidate,
                      ),
                    );
                    await upload(retryItem, remainingIds);
                  })();
                }}
              >
                Retry upload
              </button>
            )}
            <button type="button" onClick={() => void remove(item)}>
              Remove {item.file.name}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
