import type { FeedKudo } from '@good-job/contracts';

import { MediaAttachmentView } from '../../features/media/MediaAttachmentView.js';
import { Avatar, Badge } from '../../shared/ui/index.js';

export function KudoContent({
  kudo,
  headingLevel = 2,
}: {
  kudo: FeedKudo;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';

  return (
    <>
      <header className="flex items-start gap-3">
        <div className="flex shrink-0 -space-x-2">
          <Avatar
            name={kudo.sender.displayName}
            src={kudo.sender.avatarUrl}
            size="medium"
          />
          <Avatar
            name={kudo.receiver.displayName}
            src={kudo.receiver.avatarUrl}
            size="medium"
          />
        </div>
        <div className="min-w-0 flex-1">
          <Heading
            className="m-0 text-gj-lg leading-snug font-extrabold text-gj-brand-700"
            aria-label={`${kudo.sender.displayName} recognized ${kudo.receiver.displayName}`}
          >
            <span>{kudo.sender.displayName}</span>
            <span className="font-medium text-gj-text-secondary">
              {' '}
              recognized{' '}
            </span>
            <span>{kudo.receiver.displayName}</span>
          </Heading>
          <time
            className="mt-1 block text-gj-xs text-gj-text-muted"
            dateTime={kudo.committedAt}
          >
            {new Date(kudo.committedAt).toLocaleString()}
          </time>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Badge tone="primary">{kudo.coreValue.name}</Badge>
        <Badge tone="warning">{kudo.points} Giving Points</Badge>
      </div>

      <p className="m-0 whitespace-pre-wrap text-gj-md leading-7 text-gj-text">
        {kudo.description}
      </p>

      {kudo.attachments.length > 0 && (
        <div
          className={
            kudo.attachments.length > 1
              ? 'grid gap-3 md:grid-cols-2'
              : 'grid gap-3'
          }
          aria-label="Kudo media"
        >
          {kudo.attachments.map((attachment) => (
            <MediaAttachmentView
              key={attachment.id}
              attachmentId={attachment.id}
            />
          ))}
        </div>
      )}
    </>
  );
}
