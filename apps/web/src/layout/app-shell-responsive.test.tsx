// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { PrimaryNavigation } from './PrimaryNavigation.js';

afterEach(() => cleanup());

describe('VR-2 responsive App Shell contract', () => {
  it('defines an intentional icon-first tablet composition', () => {
    render(
      <MemoryRouter>
        <PrimaryNavigation placement="desktop" />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toHaveClass('max-mobile:hidden');
    expect(screen.getByText('Home')).toHaveClass(
      'max-tablet:hidden',
      'max-mobile:inline',
    );
  });

  it('switches mobile navigation to a safe-area-aware bottom bar', () => {
    render(
      <MemoryRouter>
        <PrimaryNavigation placement="mobile" />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toHaveClass(
      'fixed',
      'bottom-0',
      'max-mobile:grid',
      'pb-[max(0.25rem,env(safe-area-inset-bottom))]',
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveClass(
      'max-mobile:min-w-0',
    );
  });
});
