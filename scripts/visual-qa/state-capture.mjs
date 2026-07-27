/* global fetch */

import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import {
  createCdpClient,
  delay,
  evaluate,
  waitForDevTools,
  waitForExpression,
} from './cdp.mjs';

const chromeBinary =
  process.env.CHROME_BIN ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const debugPort = 9334;
const evidenceDirectory =
  process.env.VISUAL_EVIDENCE_DIR ??
  join(tmpdir(), 'good-job-vr6-state-evidence');
const profileDirectory = mkdtempSync(join(tmpdir(), 'good-job-vr6-states-'));
mkdirSync(evidenceDirectory, { recursive: true });
const chrome = spawn(
  chromeBinary,
  [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDirectory}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const states = [
  {
    name: 'loading',
    route: '/wallet',
    ready: "document.body.textContent.includes('Loading Wallet overview')",
  },
  {
    name: 'empty',
    route: '/rewards',
    ready: "document.body.textContent.includes('No active rewards')",
  },
  {
    name: 'error',
    route: '/rewards',
    ready: "document.body.textContent.includes('temporarily unavailable')",
  },
  {
    name: 'pending',
    route: '/rewards/40000000-0000-4000-8000-000000000001',
    ready: "document.body.textContent.includes('Redeeming…')",
    action: 'redeem',
  },
  {
    name: 'checking',
    route: '/rewards/40000000-0000-4000-8000-000000000001',
    ready: "document.body.textContent.includes('Check redemption result')",
    action: 'redeem',
  },
  {
    name: 'processing',
    route: '/',
    ready: "document.body.textContent.includes('Media is processing')",
  },
];

try {
  await waitForDevTools(debugPort);
  for (const state of states) {
    const targetResponse = await fetch(
      `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(
        'http://localhost:8080/login',
      )}`,
      { method: 'PUT' },
    );
    const target = await targetResponse.json();
    const cdp = createCdpClient(target.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: stateFixtureSource(state.name, state.route),
    });
    await waitForExpression(cdp, "document.readyState === 'complete'");
    await login(cdp, state.route.startsWith('/rewards/') ? 1 : 0);
    await cdp.send('Page.navigate', {
      url: `http://localhost:8080${state.route}`,
    });
    await waitForExpression(
      cdp,
      "Boolean(document.querySelector('.gj-app-shell'))",
    );
    if (state.action === 'redeem') {
      await waitForExpression(
        cdp,
        "Boolean(document.querySelector('.reward-detail button'))",
      );
      await evaluate(
        cdp,
        "document.querySelector('.reward-detail button')?.click()",
      );
      await waitForExpression(
        cdp,
        "Boolean(document.querySelector('.confirmation-dialog'))",
      );
      await evaluate(
        cdp,
        "document.querySelector('.confirmation-dialog button')?.click()",
      );
    }
    await waitForExpression(cdp, state.ready);
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 1000, mobile: false },
      { name: 'mobile', width: 390, height: 844, mobile: true },
    ]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.mobile,
      });
      await delay(100);
      const overflow = await evaluate(
        cdp,
        'document.documentElement.scrollWidth - window.innerWidth',
      );
      if (overflow > 1) {
        throw new Error(
          `${state.name} ${viewport.name} overflows by ${overflow}px`,
        );
      }
      const screenshot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      writeFileSync(
        join(
          evidenceDirectory,
          `${state.name}-${viewport.name}-${viewport.width}.png`,
        ),
        Buffer.from(screenshot.data, 'base64'),
      );
    }
    process.stdout.write(`PASS ${state.name} desktop/mobile state capture\n`);
    cdp.close();
  }
  process.stdout.write(`State evidence: ${evidenceDirectory}\n`);
} finally {
  chrome.kill('SIGTERM');
  rmSync(profileDirectory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

async function login(cdp, userIndex) {
  const result = await evaluate(
    cdp,
    `(async () => {
      const users = await (
        await fetch('http://localhost:3000/auth/demo-users', {
          credentials: 'include',
        })
      ).json();
      const employeeId = users.users?.[${userIndex}]?.id;
      const response = await fetch('http://localhost:3000/auth/demo-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ employeeId }),
      });
      return response.ok;
    })()`,
    true,
  );
  if (!result) throw new Error('VR-6 state fixture login failed');
}

function stateFixtureSource(state, route) {
  return `(() => {
    const originalFetch = window.fetch.bind(window);
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    window.fetch = async (input, init) => {
      const url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (${JSON.stringify(state)} === 'loading' && url.includes('/wallet/overview')) {
        return new Promise(() => {});
      }
      if (
        ${JSON.stringify(state)} === 'empty' &&
        method === 'GET' &&
        /\\/rewards$/.test(url)
      ) {
        return json({ items: [] });
      }
      if (
        ${JSON.stringify(state)} === 'error' &&
        method === 'GET' &&
        /\\/rewards$/.test(url)
      ) {
        return json(
          { code: 'TEMPORARY_UNAVAILABLE', message: 'Try later', requestId: 'vr6-error' },
          503,
        );
      }
      if (
        (${JSON.stringify(state)} === 'pending' || ${JSON.stringify(state)} === 'checking') &&
        method === 'POST' &&
        url.endsWith(${JSON.stringify(`${route}/redeem`)})
      ) {
        if (${JSON.stringify(state)} === 'pending') return new Promise(() => {});
        throw new TypeError('VR-6 deterministic unknown result');
      }
      if (
        ${JSON.stringify(state)} === 'processing' &&
        method === 'GET' &&
        url.includes('/media/95000000-0000-4000-8000-000000000002')
      ) {
        return json({
          attachment: {
            id: '95000000-0000-4000-8000-000000000002',
            ownerType: 'kudo',
            ownerId: '50000000-0000-4000-8000-000000000001',
            mediaType: 'video',
            status: 'processing',
            mimeType: 'video/mp4',
            originalName: 'recognition-video.mp4',
            sizeBytes: 1024,
            durationSeconds: null,
            failureCode: null,
            contentUrl: null,
          },
        });
      }
      const response = await originalFetch(input, init);
      if (
        (${JSON.stringify(state)} === 'pending' || ${JSON.stringify(state)} === 'checking') &&
        method === 'GET' &&
        url.endsWith(${JSON.stringify(route)}) &&
        response.ok
      ) {
        const body = await response.clone().json();
        return json({
          ...body,
          eligibility: { currentBalance: 100, eligible: true, reason: 'eligible' },
        });
      }
      if (
        ${JSON.stringify(state)} === 'processing' &&
        method === 'GET' &&
        url.includes('/kudos?') &&
        response.ok
      ) {
        const body = await response.clone().json();
        if (body.items?.[0]) {
          body.items[0].attachments = [{
            id: '95000000-0000-4000-8000-000000000002',
            mediaType: 'video',
            status: 'processing',
          }];
        }
        return json(body);
      }
      return response;
    };
  })();`;
}
