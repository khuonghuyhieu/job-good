import { createHash, createHmac } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ServerConfig } from '@good-job/config';

import { CONFIG } from '../config.js';

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}
function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

@Injectable()
export class WorkerObjectStorageService {
  constructor(@Inject(CONFIG) private readonly config: ServerConfig) {}

  presignRead(objectKey: string): string {
    const now = new Date();
    const full = now.toISOString().replace(/[:-]|\.\d{3}/gu, '');
    const short = full.slice(0, 8);
    const scope = `${short}/${this.config.OBJECT_STORAGE_REGION}/s3/aws4_request`;
    const endpoint = new URL(this.config.OBJECT_STORAGE_ENDPOINT);
    const query: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.config.OBJECT_STORAGE_ACCESS_KEY}/${scope}`,
      'X-Amz-Date': full,
      'X-Amz-Expires': '300',
      'X-Amz-SignedHeaders': 'host',
    };
    const canonicalQuery = Object.entries(query)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encode(key)}=${encode(value)}`)
      .join('&');
    const path = `/${encode(this.config.OBJECT_STORAGE_BUCKET)}/${objectKey
      .split('/')
      .map(encode)
      .join('/')}`;
    const request = [
      'GET',
      path,
      canonicalQuery,
      `host:${endpoint.host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      full,
      scope,
      createHash('sha256').update(request).digest('hex'),
    ].join('\n');
    const dateKey = hmac(`AWS4${this.config.OBJECT_STORAGE_SECRET_KEY}`, short);
    const regionKey = hmac(dateKey, this.config.OBJECT_STORAGE_REGION);
    const serviceKey = hmac(regionKey, 's3');
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');
    endpoint.pathname = path;
    endpoint.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
    return endpoint.toString();
  }

  async ping(): Promise<void> {
    const response = await fetch(
      `${this.config.OBJECT_STORAGE_ENDPOINT}/minio/health/live`,
    );
    if (!response.ok) throw new Error('Object storage is unavailable.');
  }
}
