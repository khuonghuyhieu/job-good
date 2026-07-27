import { useQuery } from '@tanstack/react-query';

import { getMediaStatus, mediaQueryKey } from './api.js';
import { AppIcon, Skeleton } from '../../shared/ui/index.js';

export function MediaAttachmentView({
  attachmentId,
}: {
  attachmentId: string;
}) {
  const media = useQuery({
    queryKey: mediaQueryKey(attachmentId),
    queryFn: () => getMediaStatus(attachmentId),
    refetchInterval: (query) =>
      query.state.data?.attachment.status === 'processing' ? 2000 : false,
  });
  if (media.isPending)
    return (
      <div
        className="grid min-h-56 place-items-center overflow-hidden rounded-gj-md bg-gj-surface-subtle"
        role="status"
      >
        <Skeleton className="h-full min-h-56 w-full" />
        <span className="sr-only">Loading attachment…</span>
      </div>
    );
  if (media.isError || !media.data) {
    return (
      <div
        className="grid min-h-40 place-items-center rounded-gj-md border border-gj-danger/20 bg-gj-danger-subtle p-5 text-center text-gj-sm text-gj-danger"
        role="alert"
      >
        Attachment status is unavailable.
      </div>
    );
  }
  const attachment = media.data.attachment;
  if (attachment.status === 'uploading') {
    return (
      <div
        className="grid min-h-48 place-items-center gap-3 rounded-gj-md border border-gj-info/20 bg-gj-info-subtle p-6 text-center text-gj-sm text-gj-info"
        role="status"
      >
        <AppIcon name="media" className="size-8" />
        <span>Media upload is not complete yet.</span>
      </div>
    );
  }
  if (attachment.status === 'processing') {
    return (
      <div
        className="grid min-h-48 place-items-center gap-3 rounded-gj-md border border-gj-info/20 bg-gj-info-subtle p-6 text-center text-gj-sm text-gj-info"
        role="status"
      >
        <AppIcon name="media" className="size-8" />
        <span>Media is processing. It is not ready yet.</span>
      </div>
    );
  }
  if (attachment.status === 'failed') {
    return (
      <div
        className="grid min-h-40 place-items-center rounded-gj-md border border-gj-danger/20 bg-gj-danger-subtle p-5 text-center text-gj-sm text-gj-danger"
        role="alert"
      >
        Media processing failed.
      </div>
    );
  }
  if (!attachment.contentUrl) {
    return (
      <div
        className="rounded-gj-md border border-gj-danger/20 bg-gj-danger-subtle p-5 text-center text-gj-sm text-gj-danger"
        role="alert"
      >
        Ready media URL is unavailable.
      </div>
    );
  }
  return attachment.mediaType === 'image' ? (
    <img
      className="block max-h-[34rem] w-full rounded-gj-md bg-gj-surface-subtle object-contain"
      src={attachment.contentUrl}
      alt={attachment.originalName}
    />
  ) : (
    <video
      className="block max-h-[34rem] w-full rounded-gj-md bg-gj-brand-700 object-contain"
      controls
      preload="metadata"
      src={attachment.contentUrl}
      aria-label={attachment.originalName}
    />
  );
}
