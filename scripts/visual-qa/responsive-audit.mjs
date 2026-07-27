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
const debugPort = 9333;
const inspectedRoute = process.env.RESPONSIVE_ROUTE ?? '/wallet';
const inspectedState = process.env.VR6_STATE ?? 'populated';
const profileDirectory = mkdtempSync(join(tmpdir(), 'good-job-vr2-chrome-'));
const evidenceDirectory =
  process.env.VISUAL_EVIDENCE_DIR ??
  mkdtempSync(join(tmpdir(), 'good-job-vr25-evidence-'));
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

try {
  await waitForDevTools(debugPort);
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
  const browserErrors = [];
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') {
      browserErrors.push({
        kind: 'console.error',
        value: params.args.map((argument) => argument.value ?? '').join(' '),
      });
    }
  });
  cdp.on('Runtime.exceptionThrown', (params) => {
    browserErrors.push({
      kind: 'exception',
      value: params.exceptionDetails.text,
    });
  });
  cdp.on('Log.entryAdded', ({ entry }) => {
    const expectedUnauthenticatedProbe =
      entry.text.includes('401 (Unauthorized)');
    if (entry.level === 'error' && !expectedUnauthenticatedProbe) {
      browserErrors.push({ kind: 'log', value: entry.text });
    }
  });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      window.__goodJobQaErrors = [];
      const record = (kind, value) => {
        window.__goodJobQaErrors.push({
          kind,
          value: String(value instanceof Error ? value.stack ?? value.message : value),
        });
      };
      const originalError = console.error.bind(console);
      console.error = (...values) => {
        record('console.error', values.map(String).join(' '));
        originalError(...values);
      };
      window.addEventListener('error', (event) =>
        record('window.error', event.error ?? event.message),
      );
      window.addEventListener('unhandledrejection', (event) =>
        record('unhandledrejection', event.reason),
      );
    })();`,
  });
  await installVisualFixture(cdp, inspectedRoute, inspectedState);
  await waitForExpression(cdp, "document.readyState === 'complete'");
  if (inspectedRoute === '/login') {
    await cdp.send('Page.reload');
    await waitForExpression(
      cdp,
      "Boolean(document.querySelector('.login-page'))",
    );
  } else if (inspectedRoute.startsWith('/rewards/')) {
    await loginDemoUser(cdp, '20000000-0000-4000-8000-000000000002');
  } else {
    await loginDemoUser(cdp);
  }
  if (inspectedRoute !== '/login') {
    await cdp.send('Page.navigate', {
      url: `http://localhost:8080${inspectedRoute}`,
    });
    await waitForExpression(
      cdp,
      "Boolean(document.querySelector('.gj-app-shell'))",
    );
  }
  if (inspectedRoute === '/') {
    await evaluate(
      cdp,
      `document.querySelector('[data-dashboard-composer] button[aria-controls="give-kudo-form"]')?.click()`,
    );
    await waitForExpression(
      cdp,
      "Boolean(document.querySelector('#give-kudo-form'))",
    );
  }

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
    if (inspectedRoute.startsWith('/rewards/')) {
      await evaluate(
        cdp,
        `document.querySelector('.reward-detail button')?.click()`,
      );
      await waitForExpression(
        cdp,
        "Boolean(document.querySelector('.confirmation-dialog'))",
      );
    }
    const result = await evaluate(
      cdp,
      responsiveExpression(
        viewport.name,
        inspectedRoute === '/',
        false,
        inspectedRoute,
      ),
    );
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
    if (inspectedRoute.startsWith('/rewards/')) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Escape',
        code: 'Escape',
      });
      await waitForExpression(
        cdp,
        "!document.querySelector('.confirmation-dialog')",
      );
    }
  }

  if (inspectedRoute === '/') {
    await cdp.send('Page.navigate', {
      url: 'http://localhost:8080/kudos/50000000-0000-4000-8000-000000000001',
    });
    await waitForExpression(
      cdp,
      "Boolean(document.querySelector('main article'))",
    );
    for (const viewport of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.name === 'mobile',
      });
      await delay(100);
      const result = await evaluate(
        cdp,
        responsiveExpression(viewport.name, false, true, inspectedRoute),
      );
      assertViewport(viewport.name, result);
      const screenshot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      writeFileSync(
        join(
          evidenceDirectory,
          `kudo-focus-${viewport.name}-${viewport.width}.png`,
        ),
        Buffer.from(screenshot.data, 'base64'),
      );
      process.stdout.write(
        `PASS Kudo Focus ${viewport.name} ${viewport.width}x${viewport.height}: no overflow, recognition and discussion cards fit viewport\n`,
      );
    }
  }

  await assertKeyboardOrder(cdp, inspectedRoute);
  await assertAccessibilityAndStress(cdp, inspectedRoute);
  await assertThemeContrast(cdp);

  if (inspectedRoute !== '/login') {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await delay(100);
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
    process.stdout.write(
      'PASS mobile notification popover stays in viewport\n',
    );
  }
  if (browserErrors.length > 0) {
    throw new Error(
      `Browser console/runtime errors: ${JSON.stringify(browserErrors)}`,
    );
  }
  process.stdout.write('PASS browser console/runtime error audit\n');
  process.stdout.write(`Visual evidence: ${evidenceDirectory}\n`);
  cdp.close();
} finally {
  chrome.kill('SIGTERM');
  rmSync(profileDirectory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

async function loginDemoUser(cdp, preferredEmployeeId) {
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
      const employeeId =
        ${JSON.stringify(preferredEmployeeId ?? null)} ??
        users.users?.[0]?.id;
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

async function installVisualFixture(cdp, route, state) {
  if (!route.startsWith('/rewards/')) return;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const requestUrl =
          typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
        ${
          state === 'checking'
            ? `if (
                method.toUpperCase() === 'POST' &&
                requestUrl.endsWith(${JSON.stringify(`${route}/redeem`)})
              ) {
                throw new TypeError('VR-6 deterministic unknown result');
              }`
            : ''
        }
        const response = await originalFetch(input, init);
        if (
          method.toUpperCase() === 'GET' &&
          requestUrl.endsWith(${JSON.stringify(route)}) &&
          response.ok
        ) {
          const body = await response.clone().json();
          return new Response(
            JSON.stringify({
              ...body,
              eligibility: {
                currentBalance: Math.max(body.costPoints, 100),
                eligible: true,
                reason: 'eligible',
              },
            }),
            {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            },
          );
        }
        return response;
      };
    })();`,
  });
}

function responsiveExpression(name, inspectDashboard, inspectKudoFocus, route) {
  return `(() => {
    const primary = document.querySelector(
      '[aria-label="Primary navigation"]',
    );
    const mobile = document.querySelector(
      '[aria-label="Mobile navigation"]',
    );
    const mobileRect = mobile?.getBoundingClientRect();
    return {
      name: ${JSON.stringify(name)},
      viewportWidth: window.innerWidth,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      primaryDisplay: primary ? getComputedStyle(primary).display : null,
      mobileDisplay: mobile ? getComputedStyle(mobile).display : null,
      mobilePosition: mobile ? getComputedStyle(mobile).position : null,
      mobileBottom: mobileRect?.bottom ?? null,
      viewportHeight: window.innerHeight,
      labels: [...(primary?.querySelectorAll('a') ?? [])].map((link) =>
        link.getAttribute('aria-label'),
      ),
      visualLabelsHidden: [...(primary?.querySelectorAll(
        '.gj-primary-nav__label',
      ) ?? [])].every((label) => getComputedStyle(label).display === 'none'),
      notificationTriggerPosition: document.querySelector(
        '[aria-label^="Notifications"]',
      )
        ? getComputedStyle(
            document.querySelector('[aria-label^="Notifications"]'),
          ).position
        : null,
      login: ${route === '/login'}
        ? (() => {
            const main = document.querySelector('.login-page');
            const card = document.querySelector('.login-card');
            if (!main || !card) return null;
            const rect = card.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              width: rect.width,
              heading: card.querySelector('h1')?.textContent?.trim(),
            };
          })()
        : null,
      dashboard: ${inspectDashboard}
        ? (() => {
            const layout = document.querySelector('.gj-dashboard');
            const primary = document.querySelector('.gj-dashboard__primary');
            const personal = document.querySelector('.gj-dashboard__personal');
            const feed = document.querySelector('.gj-dashboard__feed');
            const community = document.querySelector(
              '.gj-dashboard__community',
            );
            if (!layout || !primary || !personal || !feed || !community) {
              return null;
            }
            const columns = getComputedStyle(layout).gridTemplateColumns
              .split(' ')
              .filter(Boolean).length;
            const primaryRect = primary.getBoundingClientRect();
            const personalRect = personal.getBoundingClientRect();
            const feedRect = feed.getBoundingClientRect();
            const communityRect = community.getBoundingClientRect();
            return {
              columns,
              primaryTop: primaryRect.top,
              personalTop: personalRect.top,
              feedTop: feedRect.top,
              communityTop: communityRect.top,
              primaryWidth: primaryRect.width,
              personalWidth: personalRect.width,
              communityWidth: communityRect.width,
            };
          })()
        : null,
      recognition: ${inspectDashboard}
        ? (() => {
            const composer = document.querySelector('#give-kudo-form');
            const receiver = document.querySelector('#receiver-group');
            const points = document.querySelector('#points-group');
            if (!composer || !receiver || !points) return null;
            const bounds = (element) => {
              const rect = element.getBoundingClientRect();
              return { left: rect.left, right: rect.right, width: rect.width };
            };
            return {
              composer: bounds(composer),
              receiver: bounds(receiver),
              points: bounds(points),
            };
          })()
        : null,
      kudoFocus: ${inspectKudoFocus}
        ? (() => {
            const main = document.querySelector('main');
            const article = main?.querySelector('article');
            const discussion = main?.querySelector('section');
            if (!main || !article || !discussion) return null;
            const bounds = (element) => {
              const rect = element.getBoundingClientRect();
              return { left: rect.left, right: rect.right, width: rect.width };
            };
            return {
              main: bounds(main),
              article: bounds(article),
              discussion: bounds(discussion),
            };
          })()
        : null,
      vr5: ${JSON.stringify(route.startsWith('/wallet') || route.startsWith('/rewards'))}
        ? (() => {
            const main = document.querySelector('main');
            const bounds = (element) => {
              if (!element) return null;
              const rect = element.getBoundingClientRect();
              return { left: rect.left, right: rect.right, width: rect.width };
            };
            const grid =
              document.querySelector('.wallet-summary') ??
              document.querySelector('.reward-grid') ??
              document.querySelector('.reward-detail > div:nth-of-type(1)');
            const dialog = document.querySelector('.confirmation-dialog');
            return {
              route: ${JSON.stringify(route)},
              main: bounds(main),
              grid: bounds(grid),
              columns: grid
                ? getComputedStyle(grid).gridTemplateColumns
                    .split(' ')
                    .filter(Boolean).length
                : 0,
              dialog: bounds(dialog),
              dialogBottom: dialog?.getBoundingClientRect().bottom ?? null,
              dialogRadiusBottom:
                dialog ? getComputedStyle(dialog).borderBottomLeftRadius : null,
            };
          })()
        : null,
    };
  })()`;
}

function assertViewport(name, result) {
  if (result.overflow > 1) {
    throw new Error(`${name} has horizontal overflow of ${result.overflow}px`);
  }
  if (result.login) {
    if (
      result.login.width <= 0 ||
      result.login.left < -1 ||
      result.login.right > result.viewportWidth + 1 ||
      result.login.heading !== 'Choose your demo employee'
    ) {
      throw new Error(
        `${name} Login surface is invalid: ${JSON.stringify(result.login)}`,
      );
    }
    return;
  }
  if (result.labels.join(',') !== 'Home,Rewards,Wallet') {
    throw new Error(`${name} navigation labels are not accessible`);
  }
  if (result.notificationTriggerPosition !== 'relative') {
    throw new Error(`${name} notification badge anchor is not relative`);
  }
  if (result.dashboard) {
    assertDashboardViewport(name, result.dashboard);
  }
  for (const surface of [
    ...(result.recognition ? Object.values(result.recognition) : []),
    ...(result.kudoFocus ? Object.values(result.kudoFocus) : []),
  ]) {
    if (
      surface.width <= 0 ||
      surface.left < -1 ||
      surface.right > result.viewportWidth + 1
    ) {
      throw new Error(
        `${name} VR-4 surface exceeds the viewport: ${JSON.stringify(surface)}`,
      );
    }
  }
  if (result.vr5) {
    assertVr5Viewport(name, result);
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

function assertVr5Viewport(name, result) {
  for (const surface of [
    result.vr5.main,
    result.vr5.grid,
    result.vr5.dialog,
  ].filter(Boolean)) {
    if (
      surface.width <= 0 ||
      surface.left < -1 ||
      surface.right > result.viewportWidth + 1
    ) {
      throw new Error(
        `${name} VR-5 surface exceeds the viewport: ${JSON.stringify(surface)}`,
      );
    }
  }
  const { route, columns, dialog } = result.vr5;
  const expectedColumns =
    route === '/wallet'
      ? name === 'mobile'
        ? 1
        : 2
      : route === '/rewards'
        ? name === 'desktop'
          ? 3
          : name === 'tablet'
            ? 2
            : 1
        : name === 'desktop'
          ? 2
          : 1;
  if (columns !== expectedColumns) {
    throw new Error(
      `${name} ${route} has ${columns} columns; expected ${expectedColumns}`,
    );
  }
  if (route.startsWith('/rewards/') && !dialog) {
    throw new Error(`${name} reward confirmation was not inspected`);
  }
  if (
    route.startsWith('/rewards/') &&
    name === 'mobile' &&
    (Math.abs(result.vr5.dialogBottom - result.viewportHeight) > 1 ||
      result.vr5.dialogRadiusBottom !== '0px')
  ) {
    throw new Error(
      `Mobile redemption confirmation is not a bottom sheet: ${JSON.stringify(
        result.vr5,
      )}`,
    );
  }
}

function assertDashboardViewport(name, dashboard) {
  if (name === 'desktop') {
    if (
      dashboard.columns !== 3 ||
      dashboard.primaryWidth <= dashboard.personalWidth ||
      dashboard.primaryWidth <= dashboard.communityWidth
    ) {
      throw new Error(
        `Desktop Dashboard is not a center-priority three-column grid: ${JSON.stringify(
          dashboard,
        )}`,
      );
    }
  } else if (name === 'tablet') {
    if (
      dashboard.columns !== 2 ||
      dashboard.primaryTop > dashboard.personalTop ||
      dashboard.personalTop > dashboard.feedTop ||
      dashboard.feedTop > dashboard.communityTop
    ) {
      throw new Error(
        `Tablet Dashboard does not place the center region first: ${JSON.stringify(
          dashboard,
        )}`,
      );
    }
  } else if (
    dashboard.columns !== 1 ||
    dashboard.primaryTop > dashboard.personalTop ||
    dashboard.personalTop > dashboard.feedTop ||
    dashboard.feedTop > dashboard.communityTop
  ) {
    throw new Error(
      `Mobile Dashboard is not a center-first single column: ${JSON.stringify(
        dashboard,
      )}`,
    );
  }
}

async function assertAccessibilityAndStress(cdp, route) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 640,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await delay(100);
  const audit = await evaluate(
    cdp,
    `(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      };
      const name = (element) => {
        const labelledBy = element.getAttribute('aria-labelledby');
        const labelledText = labelledBy
          ?.split(/\\s+/u)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ');
        const explicitLabel = element.id
          ? document.querySelector(\`label[for="\${CSS.escape(element.id)}"]\`)
              ?.textContent
          : undefined;
        return [
          element.getAttribute('aria-label') ??
            '',
          labelledText ?? '',
          explicitLabel ?? '',
          element.getAttribute('title') ?? '',
          element.getAttribute('placeholder') ?? '',
          element.textContent ?? '',
        ].find((candidate) => candidate.trim())?.trim() ?? '';
      };
      const interactive = [
        ...document.querySelectorAll(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter(visible);
      const unnamed = interactive
        .filter((element) => !name(element))
        .map((element) => element.outerHTML.slice(0, 180));
      const invalidFocusBounds = interactive
        .map((element) => {
          element.focus();
          const rect = element.getBoundingClientRect();
          return {
            name: name(element),
            left: rect.left,
            right: rect.right,
            focused: document.activeElement === element,
          };
        })
        .filter(
          (item) =>
            !item.focused ||
            item.left < -1 ||
            item.right > window.innerWidth + 1,
        );
      const ids = [...document.querySelectorAll('[id]')].map(
        (element) => element.id,
      );
      const duplicateIds = ids.filter(
        (id, index) => ids.indexOf(id) !== index,
      );
      const invalidImages = [...document.querySelectorAll('img')]
        .filter((image) => !image.hasAttribute('alt'))
        .map((image) => image.outerHTML.slice(0, 180));
      const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
        .filter(visible)
        .map((heading) => Number(heading.tagName.slice(1)));
      const skippedHeading = headings.some(
        (level, index) => index > 0 && level > headings[index - 1] + 1,
      );
      const longCopyTargets = [
        ...document.querySelectorAll('main h1, main h2, main p'),
      ].filter(visible).slice(0, 3);
      const originals = longCopyTargets.map((element) => element.textContent);
      longCopyTargets.forEach((element) => {
        element.textContent =
          'A deliberately long employee and reward description that must wrap safely across every supported viewport without hiding actions or creating horizontal overflow. '.repeat(3);
      });
      const longCopyOverflow =
        document.documentElement.scrollWidth - window.innerWidth;
      longCopyTargets.forEach((element, index) => {
        element.textContent = originals[index];
      });
      return {
        route: ${JSON.stringify(route)},
        unnamed,
        invalidFocusBounds,
        duplicateIds,
        invalidImages,
        skippedHeading,
        longCopyOverflow,
        zoomOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`,
  );
  if (
    audit.unnamed.length > 0 ||
    audit.invalidFocusBounds.length > 0 ||
    audit.duplicateIds.length > 0 ||
    audit.invalidImages.length > 0 ||
    audit.skippedHeading ||
    audit.longCopyOverflow > 1 ||
    audit.zoomOverflow > 1
  ) {
    throw new Error(
      `Accessibility/stress audit failed: ${JSON.stringify(audit)}`,
    );
  }

  await cdp.send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  const reducedMotion = await evaluate(
    cdp,
    `(() => {
      const probe = document.createElement('span');
      probe.className =
        'gj-skeleton block min-h-4 animate-gj-skeleton motion-reduce:animate-none';
      document.body.append(probe);
      const animationName = getComputedStyle(probe).animationName;
      probe.remove();
      return animationName;
    })()`,
  );
  if (reducedMotion !== 'none') {
    throw new Error(
      `Reduced-motion skeleton animation remains active: ${reducedMotion}`,
    );
  }
  await cdp.send('Emulation.setEmulatedMedia', { media: 'screen' });
  process.stdout.write(
    `PASS ${route} name/ARIA, 200% reflow, long-copy and reduced-motion audit\n`,
  );
}

async function assertKeyboardOrder(cdp, route) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(
    cdp,
    `(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      document.body.tabIndex = -1;
      document.body.focus();
    })()`,
  );
  const sequence = [];
  for (let index = 0; index < 8; index += 1) {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
    });
    sequence.push(
      await evaluate(
        cdp,
        `(() => {
          const element = document.activeElement;
          return {
            tag: element?.tagName ?? '',
            name: (
              element?.getAttribute?.('aria-label') ??
              element?.textContent ??
              ''
            ).trim(),
            hidden:
              !element ||
              getComputedStyle(element).display === 'none' ||
              getComputedStyle(element).visibility === 'hidden',
          };
        })()`,
      ),
    );
  }
  if (
    sequence.some((item) => !item.name || item.hidden) ||
    (route !== '/login' && sequence[0]?.name !== 'Skip to main content')
  ) {
    throw new Error(
      `Keyboard focus order is invalid for ${route}: ${JSON.stringify(sequence)}`,
    );
  }
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Tab',
    code: 'Tab',
    modifiers: 8,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    code: 'Tab',
    modifiers: 8,
  });
  process.stdout.write(`PASS ${route} keyboard Tab/Shift+Tab focus order\n`);
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
