// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Avatar } from './Avatar.js';
import { Button, IconButton } from './Button.js';
import { Drawer } from './Drawer.js';
import { EmptyState, ErrorState, LoadingState, Skeleton } from './Feedback.js';
import { Field, Select, TextArea, TextInput } from './Field.js';
import { Modal } from './Modal.js';
import { Popover } from './Popover.js';
import { Badge, Card, Chip, Panel } from './Surface.js';
import { Eyebrow, Heading, Text } from './Typography.js';

afterEach(() => {
  cleanup();
});

describe('VR-1 typography and surface primitives', () => {
  it('renders semantic typography and composable surfaces', () => {
    render(
      <Card data-testid="card">
        <Eyebrow>Recognition</Eyebrow>
        <Heading level={1}>Good work</Heading>
        <Text muted>Shared visual language</Text>
        <Panel aria-label="Metrics">
          <Badge tone="success">Ready</Badge>
          <Chip selected>Selected value</Chip>
        </Panel>
      </Card>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Good work' }),
    ).toHaveClass('gj-heading--1');
    expect(screen.getByTestId('card')).toHaveClass('gj-card');
    expect(screen.getByLabelText('Metrics')).toHaveClass('gj-panel');
    expect(screen.getByText('Ready')).toHaveClass('gj-badge--success');
    expect(
      screen.getByRole('button', { name: 'Selected value' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('VR-1 action primitives', () => {
  it('distinguishes pending from normal and disabled button states', async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button onClick={onClick} pending pendingLabel="Saving changes…">
        Save
      </Button>,
    );

    const pendingButton = screen.getByRole('button', {
      name: 'Saving changes…',
    });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(pendingButton);
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute(
      'aria-busy',
    );
  });

  it('requires an accessible name for icon-only actions', () => {
    render(<IconButton aria-label="Open notifications">!</IconButton>);

    expect(
      screen.getByRole('button', { name: 'Open notifications' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '!' })).not.toBeInTheDocument();
  });
});

describe('VR-1 field primitives', () => {
  it('connects labels, hints and errors to controls', () => {
    render(
      <>
        <Field
          label="Description"
          hint="Explain the contribution."
          error="Description is required."
          required
        >
          <TextArea />
        </Field>
        <Field label="Colleague">
          <Select>
            <option>An Nguyen</option>
          </Select>
        </Field>
        <Field label="Search">
          <TextInput disabled />
        </Field>
      </>,
    );

    const description = screen.getByLabelText('Description *');
    expect(description).toHaveAttribute('aria-invalid', 'true');
    expect(description).toBeRequired();
    expect(description.getAttribute('aria-describedby')).toContain('hint');
    expect(description.getAttribute('aria-describedby')).toContain('error');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Description is required.',
    );
    expect(screen.getByLabelText('Colleague')).toBeInstanceOf(
      HTMLSelectElement,
    );
    expect(screen.getByLabelText('Search')).toBeDisabled();
  });
});

describe('VR-1 avatar and feedback primitives', () => {
  it('provides stable initials and falls back when an image fails', () => {
    render(
      <>
        <Avatar name="An Nguyen" />
        <Avatar name="Binh Tran" src="/missing-avatar.png" />
      </>,
    );

    expect(screen.getByRole('img', { name: 'An Nguyen' })).toHaveTextContent(
      'AN',
    );
    fireEvent.error(
      screen.getByRole('img', { name: 'Binh Tran' }).querySelector('img')!,
    );
    expect(screen.getByRole('img', { name: 'Binh Tran' })).toHaveTextContent(
      'BT',
    );
  });

  it('represents loading, empty, error and skeleton states accessibly', async () => {
    const retry = vi.fn();
    render(
      <>
        <LoadingState title="Loading rewards" />
        <EmptyState title="No rewards" description="Come back later." />
        <ErrorState title="Could not load" onAction={retry} />
        <Skeleton data-testid="skeleton" />
      </>,
    );

    expect(
      screen.getByRole('status', { name: 'Loading rewards' }),
    ).toBeVisible();
    expect(screen.getByText('No rewards')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
    expect(screen.getByTestId('skeleton')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('VR-1 overlay primitives', () => {
  it('traps modal focus, closes with Escape and restores trigger focus', async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open modal
          </button>
          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title="Confirm action"
            footer={<Button>Confirm</Button>}
          >
            <button type="button">Secondary action</button>
          </Modal>
        </>
      );
    }

    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Open modal' });
    await userEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Confirm action' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Close dialog' }),
      ).toHaveFocus(),
    );

    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('renders a modal drawer and dismisses it from the backdrop', async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Notifications">
        <button type="button">Open Kudo</button>
      </Drawer>,
    );

    const drawer = screen.getByRole('dialog', { name: 'Notifications' });
    expect(drawer.tagName).toBe('ASIDE');
    fireEvent.mouseDown(drawer.parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('supports click, ArrowDown focus and Escape in a popover', async () => {
    render(
      <Popover
        triggerLabel="Open account menu"
        trigger="A"
        panelLabel="Account menu"
      >
        <button type="button">Sign out</button>
      </Popover>,
    );

    const trigger = screen.getByRole('button', { name: 'Open account menu' });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(
      await screen.findByRole('dialog', { name: 'Account menu' }),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign out' })).toHaveFocus(),
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Account menu' })).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
