import type {
  Comment,
  FeedKudo,
  ReactionCounts,
  ReactionState,
  SupportedEmoji,
} from '@good-job/contracts';

export const supportedEmoji: SupportedEmoji[] = [
  'celebrate',
  'heart',
  'clap',
  'fire',
];

type ReactionRow = {
  employeeId: string;
  emojiCode: string;
};

export function mapReactionState(
  reactions: ReactionRow[],
  employeeId: string,
): ReactionState {
  const counts: ReactionCounts = {
    celebrate: 0,
    heart: 0,
    clap: 0,
    fire: 0,
  };
  let currentUserReaction: SupportedEmoji | null = null;
  for (const reaction of reactions) {
    if (supportedEmoji.includes(reaction.emojiCode as SupportedEmoji)) {
      const emoji = reaction.emojiCode as SupportedEmoji;
      counts[emoji] += 1;
      if (reaction.employeeId === employeeId) {
        currentUserReaction = emoji;
      }
    }
  }
  return { counts, currentUserReaction };
}

type KudoRow = {
  id: string;
  points: number;
  description: string;
  committedAt: Date;
  sender: { id: string; displayName: string; avatarUrl: string | null };
  receiver: { id: string; displayName: string; avatarUrl: string | null };
  coreValue: { id: string; code: string; name: string };
  reactions: ReactionRow[];
  _count: { comments: number };
  attachments?: Array<{
    id: string;
    mediaType: 'image' | 'video';
    status: 'uploading' | 'processing' | 'ready' | 'failed';
  }>;
};

export function mapFeedKudo(row: KudoRow, employeeId: string): FeedKudo {
  return {
    id: row.id,
    sender: row.sender,
    receiver: row.receiver,
    coreValue: row.coreValue,
    points: row.points,
    description: row.description,
    committedAt: row.committedAt.toISOString(),
    reactions: mapReactionState(row.reactions, employeeId),
    commentCount: row._count.comments,
    attachments: row.attachments ?? [],
  };
}

type CommentRow = {
  id: string;
  kudoId: string;
  employeeId: string;
  body: string;
  createdAt: Date;
  employee: { id: string; displayName: string; avatarUrl: string | null };
};

export function mapComment(row: CommentRow, employeeId: string): Comment {
  return {
    id: row.id,
    kudoId: row.kudoId,
    author: row.employee,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    canDelete: row.employeeId === employeeId,
  };
}
