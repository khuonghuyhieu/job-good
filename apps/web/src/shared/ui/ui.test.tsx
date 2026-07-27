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

  it('supports semantic surface composition and all badge tones', () => {
    render(
      <>
        <Card as="article">Recognition</Card>
        <Panel as="aside">Context</Panel>
        {(['primary', 'success', 'warning', 'danger'] as const).map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </>,
    );

    expect(screen.getByText('Recognition').tagName).toBe('ARTICLE');
    expect(screen.getByText('Context').tagName).toBe('ASIDE');
    for (const tone of ['primary', 'success', 'warning', 'danger']) {
      expect(screen.getByText(tone)).toHaveClass(`gj-badge--${tone}`);
    }
  });

  it('uses semantic theme utilities for readable text and control states', () => {
    render(
      <>
        <Text>Body</Text>
        <Text muted>Muted</Text>
        <Button variant="secondary">Action</Button>
      </>,
    );

    expect(screen.getByText('Body')).toHaveClass('text-gj-text-secondary');
    expect(screen.getByText('Muted')).toHaveClass('text-gj-text-muted');
    expect(screen.getByRole('button')).toHaveClass(
      'border-gj-control-border',
      'focus-visible:outline-gj-focus',
    );
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

  it('keeps computed pending and selected ARIA states authoritative', () => {
    render(
      <>
        <Button pending aria-busy={false}>
          Save
        </Button>
        <Chip selected aria-pressed={false} disabled>
          Value
        </Chip>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Working…' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Value' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Value' })).toBeDisabled();
  });

  it('exposes every button variant and size without changing semantics', () => {
    const { rerender } = render(
      <Button variant="secondary" size="small">
        Action
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveClass(
      'gj-button--secondary',
      'gj-button--small',
    );
    rerender(
      <Button variant="ghost" size="large">
        Action
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveClass(
      'gj-button--ghost',
      'gj-button--large',
    );
    rerender(<Button variant="danger">Action</Button>);
    expect(screen.getByRole('button')).toHaveClass('gj-button--danger');
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
          <TextArea
            aria-describedby="external-description"
            aria-invalid={false}
          />
        </Field>
        <Field label="Colleague">
          <Select>
            <option>An Nguyen</option>
          </Select>
        </Field>
        <Field label="Search">
          <TextInput disabled />
        </Field>
        <p id="external-description">External description</p>
      </>,
    );

    const description = screen.getByLabelText('Description *');
    expect(description).toHaveAttribute('aria-invalid', 'true');
    expect(description).toBeRequired();
    expect(description.getAttribute('aria-describedby')).toContain('hint');
    expect(description.getAttribute('aria-describedby')).toContain('error');
    expect(description.getAttribute('aria-describedby')).toContain(
      'external-description',
    );
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

  it('retries avatar rendering when the image source changes', () => {
    const { rerender } = render(
      <Avatar name="An Nguyen" src="/broken-avatar.png" size="large" />,
    );
    const avatar = screen.getByRole('img', { name: 'An Nguyen' });
    fireEvent.error(avatar.querySelector('img')!);
    expect(avatar).toHaveTextContent('AN');

    rerender(
      <Avatar name="An Nguyen" src="/replacement-avatar.png" size="profile" />,
    );
    expect(avatar.querySelector('img')).toHaveAttribute(
      'src',
      '/replacement-avatar.png',
    );
    expect(avatar).toHaveClass('gj-avatar--profile');
  });

  it('maps deterministic avatar palettes to semantic theme utilities', () => {
    render(
      <>
        {['A', 'B', 'C', 'D', 'E', 'F'].map((name) => (
          <Avatar key={name} name={name} />
        ))}
      </>,
    );

    for (const avatar of screen.getAllByRole('img')) {
      expect(avatar.className).toMatch(
        /bg-gj-avatar-[1-6] border-gj-avatar-ring-[1-6]/,
      );
      expect(avatar.getAttribute('style') ?? '').not.toMatch(/#|rgb/);
    }
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
    expect(screen.getAllByRole('status')).toHaveLength(1);
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
    await userEvent.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('does not reset modal focus when an inline close callback changes', async () => {
    function RerenderingExample() {
      const [value, setValue] = useState('');
      return (
        <Modal open onClose={() => undefined} title="Edit profile">
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Modal>
      );
    }

    render(<RerenderingExample />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Close dialog' }),
      ).toHaveFocus(),
    );
    const input = screen.getByLabelText('Name');
    await userEvent.click(input);
    await userEvent.type(input, 'An');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('An');
  });

  it('supports Drawer placement, Escape and focus restoration', async () => {
    function DrawerExample() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open drawer
          </button>
          <Drawer
            open={open}
            onClose={() => setOpen(false)}
            title="Notifications"
            side="left"
          >
            <button type="button">Open Kudo</button>
          </Drawer>
        </>
      );
    }

    render(<DrawerExample />);
    const trigger = screen.getByRole('button', { name: 'Open drawer' });
    await userEvent.click(trigger);
    const drawer = screen.getByRole('dialog', { name: 'Notifications' });
    expect(drawer.parentElement).toHaveClass('gj-overlay--drawer-left');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
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
    expect(trigger).toHaveClass('relative', 'grid', 'place-items-center');
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

  it('toggles a popover by click and dismisses it outside', async () => {
    render(
      <Popover triggerLabel="Open filters" trigger="F" panelLabel="Filters">
        Filter content
      </Popover>,
    );

    const trigger = screen.getByRole('button', { name: 'Open filters' });
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull();
  });

  it('honors the modal backdrop policy', () => {
    const onClose = vi.fn();
    render(
      <Modal
        open
        onClose={onClose}
        title="Persistent result"
        closeOnBackdrop={false}
      >
        Result
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Persistent result' });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(onClose).not.toHaveBeenCalled();
  });
});
