import {
  completeMediaResponseSchema,
  createUploadIntentResponseSchema,
  mediaStatusResponseSchema,
  type CreateUploadIntentRequest,
  type CreateUploadIntentResponse,
  type MediaStatusResponse,
} from '@good-job/contracts';

import { apiRequest } from '../../api/client.js';

export const mediaQueryKey = (attachmentId: string) =>
  ['media', attachmentId] as const;

export async function createUploadIntent(
  input: CreateUploadIntentRequest,
): Promise<CreateUploadIntentResponse> {
  return createUploadIntentResponseSchema.parse(
    await apiRequest('/media/upload-intents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

export function uploadDirect(
  upload: CreateUploadIntentResponse['upload'],
  file: File,
  onProgress: (percentage: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(upload.method, upload.url);
    for (const [name, value] of Object.entries(upload.headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else
        reject(new Error(`Direct upload failed with HTTP ${request.status}.`));
    });
    request.addEventListener('error', () =>
      reject(new Error('Direct upload failed.')),
    );
    request.send(file);
  });
}

export async function completeMedia(
  attachmentId: string,
): Promise<MediaStatusResponse> {
  return completeMediaResponseSchema.parse(
    await apiRequest(`/media/${attachmentId}/complete`, { method: 'POST' }),
  );
}

export async function getMediaStatus(
  attachmentId: string,
): Promise<MediaStatusResponse> {
  return mediaStatusResponseSchema.parse(
    await apiRequest(`/media/${attachmentId}`),
  );
}

export async function removeMedia(attachmentId: string): Promise<void> {
  await apiRequest(`/media/${attachmentId}`, { method: 'DELETE' });
}
