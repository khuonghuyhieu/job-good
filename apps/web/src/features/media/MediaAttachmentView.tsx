import { useQuery } from '@tanstack/react-query';

import { getMediaStatus, mediaQueryKey } from './api.js';

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
  if (media.isPending) return <span role="status">Loading attachment…</span>;
  if (media.isError || !media.data) {
    return <span role="alert">Attachment status is unavailable.</span>;
  }
  const attachment = media.data.attachment;
  if (attachment.status === 'processing' || attachment.status === 'uploading') {
    return <div role="status">Media is processing. It is not ready yet.</div>;
  }
  if (attachment.status === 'failed') {
    return <div role="alert">Media processing failed.</div>;
  }
  if (!attachment.contentUrl) {
    return <div role="alert">Ready media URL is unavailable.</div>;
  }
  return attachment.mediaType === 'image' ? (
    <img src={attachment.contentUrl} alt={attachment.originalName} />
  ) : (
    <video controls preload="metadata" src={attachment.contentUrl}>
      <track kind="captions" />
    </video>
  );
}
