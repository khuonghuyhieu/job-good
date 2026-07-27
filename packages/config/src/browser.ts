import { z } from 'zod';

const browserEnvironmentSchema = z.object({
  VITE_API_URL: z.url(),
  VITE_WEBSOCKET_PATH: z.string().startsWith('/').default('/socket.io'),
});

export type BrowserConfig = z.infer<typeof browserEnvironmentSchema>;

export function parseBrowserConfig(
  environment: Record<string, string | boolean | undefined>,
): BrowserConfig {
  return browserEnvironmentSchema.parse(environment);
}
