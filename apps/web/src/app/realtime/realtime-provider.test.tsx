// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../session/session-context.js';
import { RealtimeProvider } from './RealtimeProvider.js';

const socketMock = vi.hoisted(() => {
  const handlers = new Map<string, (value?: unknown) => void>();
  return {
    handlers,
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: (value?: unknown) => void) => {
      handlers.set(event, handler);
    }),
  };
});

const ioMock = vi.hoisted(() => vi.fn(() => socketMock));

vi.mock('socket.io-client', () => ({ io: ioMock }));

const session: SessionContextValue = {
  status: 'authenticated',
  currentUser: {
    user: {
      id: '20000000-0000-4000-8000-000000000001',
      email: 'employee@good-job.local',
      displayName: 'Employee',
      avatarUrl: null,
      status: 'active',
      team: null,
    },
    organization: {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Good Job',
      slug: 'good-job',
      timezone: 'Asia/Ho_Chi_Minh',
    },
  },
  acceptLogin: vi.fn(),
  clearProtectedState: vi.fn(async () => undefined),
  retrySession: vi.fn(async () => undefined),
};

afterEach(() => {
  cleanup();
  socketMock.handlers.clear();
  vi.clearAllMocks();
});

describe('Phase 8 frontend realtime lifecycle', () => {
  it('refetches on reconnect and deduplicates cache effects by eventId', () => {
    const queryClient = new QueryClient();
    const cachedFeed = { pages: [{ items: [{ id: 'existing-kudo' }] }] };
    queryClient.setQueryData(['feed', 'pages'], cachedFeed);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const view = render(
      <QueryClientProvider client={queryClient}>
        <SessionContext.Provider value={session}>
          <RealtimeProvider>
            <div>protected</div>
          </RealtimeProvider>
        </SessionContext.Provider>
      </QueryClientProvider>,
    );
    expect(ioMock).toHaveBeenCalledOnce();

    socketMock.handlers.get('connect')?.();
    const reconnectInvalidations = invalidate.mock.calls.length;
    expect(reconnectInvalidations).toBeGreaterThan(0);

    const event = {
      eventId: '70000000-0000-4000-8000-000000000001',
      type: 'kudo.committed',
      organizationId: session.currentUser.organization.id,
      occurredAt: '2026-07-27T00:00:00.000Z',
      payload: {
        kudoId: '60000000-0000-4000-8000-000000000001',
        senderId: '20000000-0000-4000-8000-000000000001',
        receiverId: '20000000-0000-4000-8000-000000000002',
        coreValueId: '30000000-0000-4000-8000-000000000001',
        points: 20,
        description: 'Well done.',
      },
    };
    socketMock.handlers.get('realtime.event')?.(event);
    const afterFirstDelivery = invalidate.mock.calls.length;
    expect(afterFirstDelivery).toBeGreaterThan(reconnectInvalidations);
    socketMock.handlers.get('realtime.event')?.(event);
    expect(invalidate.mock.calls.length).toBe(afterFirstDelivery);
    expect(queryClient.getQueryData(['feed', 'pages'])).toEqual(cachedFeed);

    socketMock.handlers.get('realtime.event')?.({
      ...event,
      eventId: '70000000-0000-4000-8000-000000000002',
      organizationId: '90000000-0000-4000-8000-000000000001',
    });
    socketMock.handlers.get('realtime.event')?.({
      eventId: '70000000-0000-4000-8000-000000000003',
      type: 'notification.created',
      organizationId: session.currentUser.organization.id,
      recipientUserIds: ['20000000-0000-4000-8000-000000000099'],
      occurredAt: '2026-07-27T00:00:00.000Z',
      payload: {
        notificationId: '80000000-0000-4000-8000-000000000001',
      },
    });
    expect(invalidate.mock.calls.length).toBe(afterFirstDelivery);

    view.unmount();
    expect(socketMock.disconnect).toHaveBeenCalled();
  });
});
