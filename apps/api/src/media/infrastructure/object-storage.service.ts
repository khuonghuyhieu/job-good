import { createHash, createHmac, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';

import { CONFIG } from '../../config.js';

const algorithm = 'AWS4-HMAC-SHA256';
const service = 's3';

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function amzDate(date: Date): { full: string; short: string } {
  const full = date.toISOString().replace(/[:-]|\.\d{3}/gu, '');
  return { full, short: full.slice(0, 8) };
}

@Injectable()
export class ObjectStorageService {
  constructor(@Inject(CONFIG) private readonly config: ServerConfig) {}

  objectKey(organizationId: string, employeeId: string): string {
    return `${organizationId}/${employeeId}/${randomUUID()}`;
  }

  presignUpload(
    objectKey: string,
    mimeType: string,
    sizeBytes: number,
  ): { url: string; headers: Record<string, string>; expiresAt: string } {
    const expires = this.config.MEDIA_UPLOAD_URL_TTL_SECONDS;
    return {
      url: this.presign(
        'PUT',
        this.config.OBJECT_STORAGE_PUBLIC_ENDPOINT,
        objectKey,
        expires,
        { 'content-length': String(sizeBytes), 'content-type': mimeType },
      ),
      headers: { 'content-type': mimeType },
      expiresAt: new Date(Date.now() + expires * 1000).toISOString(),
    };
  }

  presignRead(objectKey: string, publicUrl = true): string {
    return this.presign(
      'GET',
      publicUrl
        ? this.config.OBJECT_STORAGE_PUBLIC_ENDPOINT
        : this.config.OBJECT_STORAGE_ENDPOINT,
      objectKey,
      300,
    );
  }

  async head(
    objectKey: string,
  ): Promise<{ sizeBytes: number; mimeType: string }> {
    const response = await fetch(
      this.presign('HEAD', this.config.OBJECT_STORAGE_ENDPOINT, objectKey, 60),
      { method: 'HEAD' },
    );
    if (!response.ok) {
      throw new Error(`Object HEAD failed with HTTP ${response.status}.`);
    }
    const sizeBytes = Number(response.headers.get('content-length'));
    const mimeType = response.headers.get('content-type')?.split(';')[0] ?? '';
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
      throw new Error('Object storage returned an invalid content length.');
    }
    return { sizeBytes, mimeType };
  }

  async readBounded(
    objectKey: string,
    maximumBytes: number,
  ): Promise<Uint8Array> {
    const response = await fetch(this.presignRead(objectKey, false));
    if (!response.ok) {
      throw new Error(`Object read failed with HTTP ${response.status}.`);
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength <= 0 ||
      contentLength > maximumBytes
    ) {
      await response.body?.cancel();
      throw new Error('Object read exceeds the configured bound.');
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async remove(objectKey: string): Promise<void> {
    const response = await fetch(
      this.presign(
        'DELETE',
        this.config.OBJECT_STORAGE_ENDPOINT,
        objectKey,
        60,
      ),
      { method: 'DELETE' },
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(`Object delete failed with HTTP ${response.status}.`);
    }
  }

  private presign(
    method: string,
    endpoint: string,
    objectKey: string,
    expires: number,
    signedHeaders: Record<string, string> = {},
  ): string {
    const now = new Date();
    const date = amzDate(now);
    const endpointUrl = new URL(endpoint);
    const scope = `${date.short}/${this.config.OBJECT_STORAGE_REGION}/${service}/aws4_request`;
    const headers = {
      host: endpointUrl.host,
      ...Object.fromEntries(
        Object.entries(signedHeaders).map(([key, value]) => [
          key.toLowerCase(),
          value.trim(),
        ]),
      ),
    };
    const headerNames = Object.keys(headers).sort();
    const query: Record<string, string> = {
      'X-Amz-Algorithm': algorithm,
      'X-Amz-Credential': `${this.config.OBJECT_STORAGE_ACCESS_KEY}/${scope}`,
      'X-Amz-Date': date.full,
      'X-Amz-Expires': String(expires),
      'X-Amz-SignedHeaders': headerNames.join(';'),
    };
    const canonicalQuery = Object.entries(query)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encode(key)}=${encode(value)}`)
      .join('&');
    const canonicalUri = `/${encode(this.config.OBJECT_STORAGE_BUCKET)}/${objectKey
      .split('/')
      .map(encode)
      .join('/')}`;
    const canonicalHeaders = headerNames
      .map((name) => `${name}:${headers[name as keyof typeof headers]}\n`)
      .join('');
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      headerNames.join(';'),
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
      algorithm,
      date.full,
      scope,
      hash(canonicalRequest),
    ].join('\n');
    const dateKey = hmac(
      `AWS4${this.config.OBJECT_STORAGE_SECRET_KEY}`,
      date.short,
    );
    const regionKey = hmac(dateKey, this.config.OBJECT_STORAGE_REGION);
    const serviceKey = hmac(regionKey, service);
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');
    endpointUrl.pathname = canonicalUri;
    endpointUrl.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
    return endpointUrl.toString();
  }
}
