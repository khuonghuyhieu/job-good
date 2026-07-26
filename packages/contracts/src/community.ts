import { z } from 'zod';

export const supportedEmojiSchema = z.enum([
  'celebrate',
  'heart',
  'clap',
  'fire',
]);

export const employeeSummarySchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
  avatarUrl: z.url().nullable(),
});

export const communityCoreValueSchema = z.object({
  id: z.uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
});

export const reactionCountsSchema = z.object({
  celebrate: z.number().int().nonnegative(),
  heart: z.number().int().nonnegative(),
  clap: z.number().int().nonnegative(),
  fire: z.number().int().nonnegative(),
});

export const reactionStateSchema = z.object({
  counts: reactionCountsSchema,
  currentUserReaction: supportedEmojiSchema.nullable(),
});

export const feedQuerySchema = z
  .object({
    cursor: z.string().min(1).max(2048).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

export const feedKudoSchema = z.object({
  id: z.uuid(),
  sender: employeeSummarySchema,
  receiver: employeeSummarySchema,
  coreValue: communityCoreValueSchema,
  points: z.number().int().min(10).max(50),
  description: z.string().min(1),
  committedAt: z.string().datetime(),
  reactions: reactionStateSchema,
  commentCount: z.number().int().nonnegative(),
  attachments: z.array(
    z.object({
      id: z.uuid(),
      mediaType: z.enum(['image', 'video']),
      status: z.enum(['uploading', 'processing', 'ready', 'failed']),
    }),
  ),
});

export const feedResponseSchema = z.object({
  items: z.array(feedKudoSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const commentSchema = z.object({
  id: z.uuid(),
  kudoId: z.uuid(),
  author: employeeSummarySchema,
  body: z.string().min(1),
  createdAt: z.string().datetime(),
  canDelete: z.boolean(),
});

export const kudoDetailResponseSchema = feedKudoSchema.extend({
  comments: z.array(commentSchema),
});

export const setReactionRequestSchema = z
  .object({ emojiCode: supportedEmojiSchema })
  .strict();

export const reactionResponseSchema = z.object({
  kudoId: z.uuid(),
  reactions: reactionStateSchema,
});

export const createCommentRequestSchema = z
  .object({ body: z.string().trim().min(1, 'Comment text is required.') })
  .strict();

export const createCommentResponseSchema = z.object({
  comment: commentSchema,
});

export type SupportedEmoji = z.infer<typeof supportedEmojiSchema>;
export type ReactionCounts = z.infer<typeof reactionCountsSchema>;
export type ReactionState = z.infer<typeof reactionStateSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type FeedKudo = z.infer<typeof feedKudoSchema>;
export type FeedResponse = z.infer<typeof feedResponseSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type KudoDetailResponse = z.infer<typeof kudoDetailResponseSchema>;
export type SetReactionRequest = z.infer<typeof setReactionRequestSchema>;
export type ReactionResponse = z.infer<typeof reactionResponseSchema>;
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;
export type CreateCommentResponse = z.infer<typeof createCommentResponseSchema>;
