import { z } from 'zod';

export const mediaTypeSchema = z.enum(['image', 'video']);
export const mediaStatusSchema = z.enum([
  'uploading',
  'processing',
  'ready',
  'failed',
]);

export const supportedMediaMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;
export const mediaMimeTypeSchema = z.enum(supportedMediaMimeTypes);

export const createUploadIntentRequestSchema = z
  .object({
    ownerType: z.literal('kudo'),
    mediaType: mediaTypeSchema,
    mimeType: z.string().min(1),
    originalName: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export const mediaAttachmentSchema = z.object({
  id: z.uuid(),
  ownerType: z.literal('kudo'),
  ownerId: z.uuid().nullable(),
  mediaType: mediaTypeSchema,
  status: mediaStatusSchema,
  mimeType: mediaMimeTypeSchema,
  originalName: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  durationSeconds: z.number().nonnegative().nullable(),
  failureCode: z.string().min(1).nullable(),
  contentUrl: z.url().nullable(),
});

export const createUploadIntentResponseSchema = z.object({
  attachment: mediaAttachmentSchema,
  upload: z.object({
    method: z.literal('PUT'),
    url: z.url(),
    headers: z.record(z.string(), z.string()),
    expiresAt: z.string().datetime(),
  }),
});

export const completeMediaResponseSchema = z.object({
  attachment: mediaAttachmentSchema,
});

export const mediaStatusResponseSchema = completeMediaResponseSchema;

export type MediaType = z.infer<typeof mediaTypeSchema>;
export type MediaStatus = z.infer<typeof mediaStatusSchema>;
export type MediaAttachmentDto = z.infer<typeof mediaAttachmentSchema>;
export type CreateUploadIntentRequest = z.infer<
  typeof createUploadIntentRequestSchema
>;
export type CreateUploadIntentResponse = z.infer<
  typeof createUploadIntentResponseSchema
>;
export type CompleteMediaResponse = z.infer<typeof completeMediaResponseSchema>;
export type MediaStatusResponse = z.infer<typeof mediaStatusResponseSchema>;
