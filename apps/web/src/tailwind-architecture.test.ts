import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const webPackage = JSON.parse(
  readFileSync(resolve(root, 'apps/web/package.json'), 'utf8'),
) as {
  devDependencies: Record<string, string>;
};
const theme = readFileSync(resolve(root, 'apps/web/src/tailwind.css'), 'utf8');

describe('VR-2.5 Tailwind architecture', () => {
  it('pins one Tailwind/Vite toolchain and keeps the theme authoritative', () => {
    expect(webPackage.devDependencies.tailwindcss).toBe('4.3.3');
    expect(webPackage.devDependencies['@tailwindcss/vite']).toBe('4.3.3');
    expect(theme).toContain("@import 'tailwindcss'");
    expect(theme).toContain('--breakpoint-mobile: 48rem');
    expect(theme).toContain('--breakpoint-tablet: 75rem');
    expect(theme).toContain('--color-gj-overlay:');
    expect(theme).toContain('--color-gj-avatar-1:');
    expect(theme).toContain('--color-gj-skeleton-highlight:');
  });

  it('does not retain deleted VR-1/VR-2 stylesheets or unsafe class fragments', () => {
    for (const file of [
      'apps/web/src/shared/ui/tokens.css',
      'apps/web/src/shared/ui/ui.css',
      'apps/web/src/layout/app-shell.css',
    ]) {
      expect(existsSync(resolve(root, file))).toBe(false);
    }

    const migratedSources = [
      'apps/web/src/shared/ui/Avatar.tsx',
      'apps/web/src/shared/ui/DialogSurface.tsx',
      'apps/web/src/shared/ui/Feedback.tsx',
      'apps/web/src/shared/ui/Popover.tsx',
      'apps/web/src/layout/AppShell.tsx',
      'apps/web/src/layout/AppLogo.tsx',
      'apps/web/src/layout/PrimaryNavigation.tsx',
      'apps/web/src/layout/SystemStatePage.tsx',
      'apps/web/src/features/notifications/NotificationIndicator.tsx',
    ]
      .map((file) => readFileSync(resolve(root, file), 'utf8'))
      .join('\n');

    expect(migratedSources).not.toMatch(/\[&_[^\]]*__/);
    expect(migratedSources).not.toMatch(/max-\[(47|74)\./);
    expect(migratedSources).not.toMatch(/#[0-9a-fA-F]{6}|rgb\(/);
  });
});
