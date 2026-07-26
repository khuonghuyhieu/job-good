import { parseBrowserConfig } from '@good-job/config/browser';
import {
  realtimeEventEnvelopeSchema,
  realtimeSocketEventName,
  type RealtimeEventEnvelope,
} from '@good-job/contracts';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef, type PropsWithChildren } from 'react';

import { useSession } from '../session/session-context.js';
import { EventDeduplicator } from './event-deduplicator.js';
import { notificationQueryKeys } from '../../features/notifications/api.js';

const config = parseBrowserConfig(import.meta.env);

export function RealtimeProvider({ children }: PropsWithChildren) {
  const session = useSession();
  const queryClient = useQueryClient();
  const socket = useRef<Socket | null>(null);
  const dedupe = useRef(new EventDeduplicator());
  const employeeId =
    session.status === 'authenticated' ? session.currentUser.user.id : null;
  const organizationId =
    session.status === 'authenticated'
      ? session.currentUser.organization.id
      : null;

  useEffect(() => {
    if (!employeeId || !organizationId) {
      socket.current?.disconnect();
      socket.current = null;
      dedupe.current.clear();
      return;
    }
    const nextSocket = io(config.VITE_API_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
    socket.current = nextSocket;

    const refetchAuthoritativeState = () => {
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.all,
      });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['rewards'] });
    };
    nextSocket.on('connect', refetchAuthoritativeState);
    nextSocket.on(realtimeSocketEventName, (raw: unknown) => {
      const parsed = realtimeEventEnvelopeSchema.safeParse(raw);
      if (!parsed.success) return;
      const event = parsed.data;
      if (
        event.organizationId !== organizationId ||
        !dedupe.current.accept(event.eventId)
      ) {
        return;
      }
      if (
        (event.type === 'reward.redeemed' ||
          event.type === 'notification.created') &&
        !event.recipientUserIds?.includes(employeeId)
      ) {
        return;
      }
      applyEvent(queryClient, event);
    });
    return () => {
      nextSocket.disconnect();
      if (socket.current === nextSocket) socket.current = null;
      dedupe.current.clear();
    };
  }, [employeeId, organizationId, queryClient]);

  return children;
}

function applyEvent(
  queryClient: QueryClient,
  event: RealtimeEventEnvelope,
): void {
  if (
    event.type === 'kudo.committed' ||
    event.type === 'reaction.changed' ||
    event.type === 'comment.created'
  ) {
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
  }
  if (event.type === 'kudo.committed') {
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
  }
  if (event.type === 'reward.redeemed') {
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['rewards'] });
  }
  if (event.type === 'media.status_changed') {
    const attachmentId = event.payload['attachmentId'];
    if (typeof attachmentId === 'string') {
      void queryClient.invalidateQueries({
        queryKey: ['media', attachmentId],
      });
    }
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
  }
  if (event.type === 'notification.created') {
    void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
  }
}
