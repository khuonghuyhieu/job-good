/* global WebSocket, fetch, setTimeout */

import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const chromeBinary =
  process.env.CHROME_BIN ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const debugPort = 9333;
const profileDirectory = mkdtempSync(join(tmpdir(), 'good-job-vr2-chrome-'));
const evidenceDirectory = mkdtempSync(
  join(tmpdir(), 'good-job-vr25-evidence-'),
);
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

try {
  await waitForDevTools();
  const targetResponse = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(
      'http://localhost:8080/login',
    )}`,
    { method: 'PUT' },
  );
  if (!targetResponse.ok) {
    throw new Error(`Could not create Chrome target: ${targetResponse.status}`);
  }
  const target = await targetResponse.json();
  const cdp = createCdpClient(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await waitForExpression(cdp, "document.readyState === 'complete'");
  await loginDemoUser(cdp);
  await cdp.send('Page.navigate', { url: 'http://localhost:8080/wallet' });
  await waitForExpression(
    cdp,
    "Boolean(document.querySelector('.gj-app-shell'))",
  );

  const viewports = [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'desktop', width: 1200, height: 900 },
    { name: 'tablet', width: 900, height: 1000 },
    { name: 'tablet', width: 1199, height: 900 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'mobile', width: 767, height: 900 },
  ];

  for (const viewport of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.name === 'mobile',
    });
    await delay(100);
    const result = await evaluate(cdp, responsiveExpression(viewport.name));
    assertViewport(viewport.name, result);
    const screenshot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    writeFileSync(
      join(evidenceDirectory, `${viewport.name}-${viewport.width}.png`),
      Buffer.from(screenshot.data, 'base64'),
    );
    process.stdout.write(
      `PASS ${viewport.name} ${viewport.width}x${viewport.height}: no overflow, expected navigation visible\n`,
    );
  }

  await assertThemeContrast(cdp);
  await assertLegacyControlCompatibility(cdp);

  await evaluate(
    cdp,
    'document.querySelector(\'[aria-label^="Notifications"]\')?.click()',
  );
  await waitForExpression(
    cdp,
    "Boolean(document.querySelector('.gj-notification-panel'))",
  );
  const popoverBounds = await evaluate(
    cdp,
    `(() => {
      const panel = document.querySelector('.gj-popover__panel');
      const rect = panel.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    })()`,
  );
  if (
    popoverBounds.left < 0 ||
    popoverBounds.right > popoverBounds.viewportWidth + 1 ||
    popoverBounds.top < 0 ||
    popoverBounds.bottom > popoverBounds.viewportHeight + 1
  ) {
    throw new Error(
      `Mobile notification popover is outside viewport: ${JSON.stringify(
        popoverBounds,
      )}`,
    );
  }
  process.stdout.write('PASS mobile notification popover stays in viewport\n');
  process.stdout.write(`Visual evidence: ${evidenceDirectory}\n`);
  cdp.close();
} finally {
  chrome.kill('SIGTERM');
  rmSync(profileDirectory, { recursive: true, force: true });
}

async function loginDemoUser(cdp) {
  const result = await evaluate(
    cdp,
    `(async () => {
      const usersResponse = await fetch(
        'http://localhost:3000/auth/demo-users',
        { credentials: 'include' },
      );
      if (!usersResponse.ok) {
        return { ok: false, step: 'users', status: usersResponse.status };
      }
      const users = await usersResponse.json();
      const employeeId = users.users?.[0]?.id;
      if (!employeeId) return { ok: false, step: 'users-empty' };
      const loginResponse = await fetch(
        'http://localhost:3000/auth/demo-login',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ employeeId }),
        },
      );
      return { ok: loginResponse.ok, step: 'login', status: loginResponse.status };
    })()`,
    true,
  );
  if (!result.ok) {
    throw new Error(`Demo login failed: ${JSON.stringify(result)}`);
  }
}

function responsiveExpression(name) {
  return `(() => {
    const primary = document.querySelector(
      '[aria-label="Primary navigation"]',
    );
    const mobile = document.querySelector(
      '[aria-label="Mobile navigation"]',
    );
    const mobileRect = mobile.getBoundingClientRect();
    return {
      name: ${JSON.stringify(name)},
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      primaryDisplay: getComputedStyle(primary).display,
      mobileDisplay: getComputedStyle(mobile).display,
      mobilePosition: getComputedStyle(mobile).position,
      mobileBottom: mobileRect.bottom,
      viewportHeight: window.innerHeight,
      labels: [...primary.querySelectorAll('a')].map((link) =>
        link.getAttribute('aria-label'),
      ),
      visualLabelsHidden: [...primary.querySelectorAll(
        '.gj-primary-nav__label',
      )].every((label) => getComputedStyle(label).display === 'none'),
      notificationTriggerPosition: getComputedStyle(
        document.querySelector('[aria-label^="Notifications"]'),
      ).position,
    };
  })()`;
}

function assertViewport(name, result) {
  if (result.overflow > 1) {
    throw new Error(`${name} has horizontal overflow of ${result.overflow}px`);
  }
  if (result.labels.join(',') !== 'Home,Rewards,Wallet') {
    throw new Error(`${name} navigation labels are not accessible`);
  }
  if (result.notificationTriggerPosition !== 'relative') {
    throw new Error(`${name} notification badge anchor is not relative`);
  }
  if (name === 'desktop') {
    if (result.primaryDisplay === 'none' || result.mobileDisplay !== 'none') {
      throw new Error('Desktop navigation visibility is incorrect');
    }
  } else if (name === 'tablet') {
    if (
      result.primaryDisplay === 'none' ||
      result.mobileDisplay !== 'none' ||
      !result.visualLabelsHidden
    ) {
      throw new Error('Tablet icon-first navigation is incorrect');
    }
  } else if (
    result.primaryDisplay !== 'none' ||
    result.mobileDisplay === 'none' ||
    result.mobilePosition !== 'fixed' ||
    Math.abs(result.mobileBottom - result.viewportHeight) > 1
  ) {
    throw new Error('Mobile bottom navigation placement is incorrect');
  }
}

async function assertThemeContrast(cdp) {
  const ratios = await evaluate(
    cdp,
    `(() => {
      const styles = getComputedStyle(document.documentElement);
      const color = (token) => styles.getPropertyValue(token).trim();
      const channels = (value) => {
        const probe = document.createElement('span');
        probe.style.color = value;
        document.body.append(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return resolved.match(/[\\d.]+/g).slice(0, 3).map(Number);
      };
      const luminance = (value) => {
        const values = channels(value).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.03928
            ? normalized / 12.92
            : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
      };
      const contrast = (left, right) => {
        const values = [luminance(color(left)), luminance(color(right))]
          .sort((a, b) => b - a);
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      return {
        muted: contrast('--color-gj-text-muted', '--color-gj-surface'),
        control: contrast('--color-gj-control-border', '--color-gj-surface'),
        focus: contrast('--color-gj-focus', '--color-gj-surface'),
        success: contrast(
          '--color-gj-success',
          '--color-gj-success-subtle',
        ),
      };
    })()`,
  );
  const required = { muted: 4.5, control: 3, focus: 3, success: 4.5 };
  for (const [name, minimum] of Object.entries(required)) {
    if (ratios[name] < minimum) {
      throw new Error(
        `${name} contrast ${ratios[name].toFixed(2)} is below ${minimum}`,
      );
    }
  }
  process.stdout.write(
    `PASS theme contrast: ${Object.entries(ratios)
      .map(([name, ratio]) => `${name}=${ratio.toFixed(2)}`)
      .join(', ')}\n`,
  );
}

async function assertLegacyControlCompatibility(cdp) {
  const result = await evaluate(
    cdp,
    `(() => {
      const fixture = document.createElement('section');
      fixture.className = 'feed-section';
      const button = document.createElement('button');
      button.textContent = 'Legacy action';
      fixture.append(button);
      document.body.append(fixture);
      const styles = getComputedStyle(button);
      const result = {
        borderWidth: Number.parseFloat(styles.borderTopWidth),
        borderRadius: Number.parseFloat(styles.borderRadius),
        minHeight: Number.parseFloat(styles.minHeight),
        background: styles.backgroundColor,
      };
      fixture.remove();
      return result;
    })()`,
  );
  if (
    result.borderWidth < 1 ||
    result.borderRadius < 1 ||
    result.minHeight < 44 ||
    result.background === 'rgba(0, 0, 0, 0)'
  ) {
    throw new Error(
      `Legacy control lost its Preflight compatibility: ${JSON.stringify(
        result,
      )}`,
    );
  }
  process.stdout.write('PASS legacy controls retain visible affordance\n');
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 1;
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    close() {
      socket.close();
    },
  };
}

async function evaluate(cdp, expression, awaitPromise = false) {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text);
  }
  return response.result.value;
}

async function waitForExpression(cdp, expression) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(cdp, expression)) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

async function waitForDevTools() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${debugPort}/json/version`,
      );
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(50);
  }
  throw new Error('Timed out waiting for Chrome DevTools');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
