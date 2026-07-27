import { useEffect, useRef, useState } from 'react';
import type { MediaAttachmentDto } from '@good-job/contracts';

import {
  completeMedia,
  createUploadIntent,
  getMediaStatus,
  removeMedia,
  uploadDirect,
} from './api.js';
import { AppIcon, Button } from '../../shared/ui/index.js';

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
  retryable?: boolean | undefined;
  statusError?: string | undefined;
  previewUrl?: string | undefined;
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
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  const previewUrls = useRef(new Set<string>());
  const previousAttachmentIds = useRef(attachmentIds);
  const latestAttachmentIds = useRef(attachmentIds);
  useEffect(
    () => () => {
      mounted.current = false;
      for (const previewUrl of previewUrls.current) {
        URL.revokeObjectURL(previewUrl);
      }
      previewUrls.current.clear();
    },
    [],
  );
  useEffect(() => {
    latestAttachmentIds.current = attachmentIds;
    if (
      previousAttachmentIds.current.length > 0 &&
      attachmentIds.length === 0
    ) {
      setItems((current) => {
        for (const item of current) {
          if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
            previewUrls.current.delete(item.previewUrl);
          }
        }
        return [];
      });
    }
    previousAttachmentIds.current = attachmentIds;
  }, [attachmentIds]);

  function publishAttachmentIds(nextAttachmentIds: string[]): void {
    const deduplicated = [...new Set(nextAttachmentIds)];
    latestAttachmentIds.current = deduplicated;
    onChange(deduplicated);
  }

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
                        ? {
                            error: 'Video processing failed.',
                            retryable: true,
                          }
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

  async function upload(item: UploadItem): Promise<void> {
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
                ...(completed.attachment.status === 'failed'
                  ? {
                      error: 'Media processing failed.',
                      retryable: true,
                    }
                  : { error: undefined, retryable: undefined }),
              }
            : candidate,
        ),
      );
      publishAttachmentIds([
        ...latestAttachmentIds.current,
        completed.attachment.id,
      ]);
    } catch {
      if (!mounted.current) return;
      setItems((current) =>
        current.map((candidate) =>
          candidate.localId === item.localId
            ? {
                ...candidate,
                state: 'failed',
                error: 'Upload failed. Your Kudo draft is preserved.',
                retryable: true,
              }
            : candidate,
        ),
      );
    }
  }

  function select(files: FileList | null): void {
    if (!files) return;
    const available = maximumFiles - items.length;
    const selectedFiles = Array.from(files);
    const acceptedFiles = selectedFiles.slice(0, available);
    setSelectionMessage(
      selectedFiles.length > acceptedFiles.length
        ? `Only ${acceptedFiles.length} ${
            acceptedFiles.length === 1 ? 'file was' : 'files were'
          } added. A Kudo can include up to five files.`
        : null,
    );
    for (const file of acceptedFiles) {
      const limit = file.type.startsWith('image/') ? imageLimit : videoLimit;
      const validationError = !supported.has(file.type)
        ? 'Unsupported file type. Choose a JPG, PNG, WebP, MP4, WebM or MOV file.'
        : file.size > limit
          ? `File is too large. Choose a ${
              file.type.startsWith('image/') ? '10 MB image' : '200 MB video'
            } or smaller.`
          : null;
      const item: UploadItem = {
        localId: crypto.randomUUID(),
        file,
        attachment: null,
        progress: 0,
        state: 'uploading',
        ...((file.type.startsWith('image/') ||
          file.type.startsWith('video/')) &&
        typeof URL.createObjectURL === 'function'
          ? { previewUrl: URL.createObjectURL(file) }
          : {}),
        ...(validationError
          ? {
              state: 'failed' as const,
              error: validationError,
              retryable: false,
            }
          : {}),
      };
      if (item.previewUrl) previewUrls.current.add(item.previewUrl);
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
      publishAttachmentIds(
        latestAttachmentIds.current.filter((id) => id !== item.attachment!.id),
      );
    }
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
      previewUrls.current.delete(item.previewUrl);
    }
  }

  return (
    <fieldset
      className="m-0 grid gap-3 rounded-gj-md border border-dashed border-gj-control-border bg-gj-surface-subtle p-4 disabled:opacity-60"
      disabled={disabled}
    >
      <legend className="px-2 text-gj-sm font-bold text-gj-brand-700">
        Optional image or video
      </legend>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-gj-md bg-white p-4 text-center transition hover:bg-gj-primary-100 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-gj-focus">
        <AppIcon name="media" className="size-7 text-gj-primary-600" />
        <span className="text-gj-sm font-bold text-gj-brand-700">
          Add up to five images or videos
        </span>
        <span className="text-gj-xs text-gj-text-secondary">
          JPG, PNG, WebP, MP4, WebM or MOV
        </span>
        <input
          className="sr-only"
          aria-label="Add image or video"
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          multiple
          disabled={disabled || items.length >= maximumFiles}
          onChange={(event) => {
            select(event.target.files);
            event.currentTarget.value = '';
          }}
        />
      </label>
      {selectionMessage && (
        <p className="m-0 text-gj-sm text-gj-warning" role="status">
          {selectionMessage}
        </p>
      )}
      <ul className="m-0 grid list-none gap-3 p-0">
        {items.map((item) => (
          <li
            className="grid min-w-0 gap-3 overflow-hidden rounded-gj-md border border-gj-border bg-white p-3"
            key={item.localId}
          >
            {item.previewUrl ? (
              <figure className="m-0 grid gap-2">
                {item.file.type.startsWith('image/') ? (
                  <img
                    className="max-h-72 w-full rounded-gj-sm bg-gj-surface-subtle object-contain"
                    src={item.previewUrl}
                    alt={`Preview of ${item.file.name}`}
                  />
                ) : (
                  <video
                    className="max-h-72 w-full rounded-gj-sm bg-black object-contain"
                    src={item.previewUrl}
                    aria-label={`Preview of ${item.file.name}`}
                    controls
                    preload="metadata"
                  />
                )}
                <figcaption className="text-gj-xs text-gj-text-secondary">
                  Preview — this media will be published only when you submit
                  the Kudo.
                </figcaption>
              </figure>
            ) : (
              <span
                className="grid size-12 place-items-center rounded-full bg-gj-primary-100 text-gj-primary-700"
                aria-hidden="true"
              >
                <AppIcon name="media" className="size-5" />
              </span>
            )}
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 max-mobile:grid-cols-1">
              <span className="min-w-0">
                <strong className="block truncate text-gj-sm">
                  {item.file.name}
                </strong>
                {item.state === 'uploading' && (
                  <span className="mt-2 grid gap-1">
                    <span className="text-gj-xs text-gj-text-secondary">
                      Uploading {item.progress}%
                    </span>
                    <progress
                      className="h-2 w-full accent-gj-primary-600"
                      value={item.progress}
                      max={100}
                    >
                      {item.progress}%
                    </progress>
                  </span>
                )}
                {item.state === 'processing' && (
                  <span className="block text-gj-xs text-gj-info" role="status">
                    Video processing…
                  </span>
                )}
                {item.statusError && (
                  <span
                    className="block text-gj-xs text-gj-danger"
                    role="alert"
                  >
                    {item.statusError}
                  </span>
                )}
                {item.state === 'ready' && (
                  <span
                    className="block text-gj-xs text-gj-success"
                    role="status"
                  >
                    Ready
                  </span>
                )}
                {item.error && (
                  <span
                    className="block text-gj-xs text-gj-danger"
                    role="alert"
                  >
                    {item.error}
                  </span>
                )}
              </span>
              <span className="flex flex-wrap justify-end gap-2 max-mobile:justify-start">
                {item.state === 'failed' && item.retryable && (
                  <Button
                    size="small"
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      const previousId = item.attachment?.id;
                      const remainingIds = previousId
                        ? latestAttachmentIds.current.filter(
                            (id) => id !== previousId,
                          )
                        : latestAttachmentIds.current;
                      void (async () => {
                        if (item.attachment && !item.attachment.ownerId) {
                          await removeMedia(item.attachment.id).catch(
                            () => undefined,
                          );
                        }
                        publishAttachmentIds(remainingIds);
                        const retryItem = {
                          ...item,
                          attachment: null,
                          progress: 0,
                          state: 'uploading' as const,
                          error: undefined,
                          retryable: undefined,
                        };
                        setItems((current) =>
                          current.map((candidate) =>
                            candidate.localId === item.localId
                              ? retryItem
                              : candidate,
                          ),
                        );
                        await upload(retryItem);
                      })();
                    }}
                  >
                    Retry upload
                  </Button>
                )}
                <Button
                  size="small"
                  variant="ghost"
                  type="button"
                  onClick={() => void remove(item)}
                >
                  Remove {item.file.name}
                </Button>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
