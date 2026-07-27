import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  ColleagueSearchResponse,
  CoreValuesResponse,
  CreateKudoRequest,
  CreateKudoResponse,
  WalletOverviewResponse,
} from '@good-job/contracts';

import { ApiClientError } from '../../api/error-adapter.js';
import { useSession } from '../../app/session/session-context.js';
import {
  colleaguesQueryKey,
  coreValuesQueryKey,
  createKudo,
  getCoreValues,
  getWalletOverview,
  searchColleagues,
  walletOverviewQueryKey,
} from './api.js';
import { feedQueryKey } from '../feed/query-keys.js';
import { GivingBudgetCard } from './GivingBudgetCard.js';
import { AttachmentPicker } from '../media/AttachmentPicker.js';
import { Avatar, Button } from '../../shared/ui/index.js';

type Draft = {
  receiverId: string;
  coreValueId: string;
  points: string;
  description: string;
  attachmentIds: string[];
};

type DraftErrors = Partial<Record<keyof Draft, string>>;

type CommandAttempt = {
  key: string;
  request: CreateKudoRequest;
};

export async function updateWalletOverviewAfterKudo(
  queryClient: QueryClient,
  response: CreateKudoResponse,
): Promise<void> {
  const previous = queryClient.getQueryData<WalletOverviewResponse>(
    walletOverviewQueryKey,
  );
  if (!previous) {
    await queryClient.invalidateQueries({ queryKey: walletOverviewQueryKey });
    return;
  }
  queryClient.setQueryData<WalletOverviewResponse>(walletOverviewQueryKey, {
    businessMonth: response.businessMonth,
    givingBudget: response.givingBudget,
    rewardBalance: previous.rewardBalance,
  });
}

const emptyDraft: Draft = {
  receiverId: '',
  coreValueId: '',
  points: '10',
  description: '',
  attachmentIds: [],
};

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

function validateDraft(
  draft: Draft,
  currentEmployeeId: string,
): { request?: CreateKudoRequest; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const points = Number(draft.points);
  if (!draft.receiverId) {
    errors.receiverId = 'Choose a colleague.';
  } else if (draft.receiverId === currentEmployeeId) {
    errors.receiverId = 'You cannot give a Kudo to yourself.';
  }
  if (!draft.coreValueId) {
    errors.coreValueId = 'Choose a Core Value.';
  }
  if (!Number.isInteger(points) || points < 10 || points > 50) {
    errors.points = 'Points must be between 10 and 50.';
  }
  if (!draft.description.trim()) {
    errors.description = 'Description is required.';
  }
  if (Object.keys(errors).length) {
    return { errors };
  }
  return {
    errors,
    request: {
      receiverId: draft.receiverId,
      coreValueId: draft.coreValueId,
      points,
      description: draft.description.trim(),
      attachmentIds: draft.attachmentIds,
    },
  };
}

function commandErrorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError)) {
    return 'The Kudo could not be sent. Your draft is preserved.';
  }
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return 'Correct the highlighted fields and try again. Your draft is preserved.';
    case 'INSUFFICIENT_GIVING_BUDGET':
      return 'Your latest Giving Budget is insufficient. Your draft is preserved.';
    case 'CORE_VALUE_UNAVAILABLE':
      return 'That Core Value is no longer available. Choose another value.';
    case 'SELF_RECOGNITION_NOT_ALLOWED':
      return 'You cannot give a Kudo to yourself.';
    case 'IDEMPOTENCY_CONFLICT':
      return 'This draft differs from a request already processed. Refresh before sending again.';
    default:
      return 'The service is temporarily unavailable. Your draft is preserved; retry safely.';
  }
}

function requiresExactRetry(error: unknown): boolean {
  return (
    !(error instanceof ApiClientError) ||
    error.status >= 500 ||
    error.code === 'UNEXPECTED_RESPONSE'
  );
}

function focusFirstInvalidField(errors: DraftErrors): void {
  const field = (
    ['receiverId', 'coreValueId', 'points', 'description'] as const
  ).find((candidate) => errors[candidate]);
  if (field) {
    const elementId = {
      receiverId: 'receiver',
      coreValueId: 'core-value',
      points: 'points',
      description: 'description',
    }[field];
    setTimeout(() => document.getElementById(elementId)?.focus(), 0);
  }
}

export function GiveKudoComposer({
  showBudgetSummary = true,
  compact = false,
}: {
  showBudgetSummary?: boolean;
  compact?: boolean;
} = {}) {
  const session = useSession();
  const queryClient = useQueryClient();
  const currentEmployeeId =
    session.status === 'authenticated' ? session.currentUser.user.id : '';
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [success, setSuccess] = useState<CreateKudoResponse | null>(null);
  const [recoveryCommand, setRecoveryCommand] = useState<CommandAttempt | null>(
    null,
  );
  const [expanded, setExpanded] = useState(!compact);
  const submitting = useRef(false);
  const compactTrigger = useRef<HTMLButtonElement>(null);

  const budgetQuery = useQuery({
    queryKey: walletOverviewQueryKey,
    queryFn: getWalletOverview,
  });
  const coreValuesQuery = useQuery({
    queryKey: coreValuesQueryKey,
    queryFn: getCoreValues,
  });
  const colleaguesQuery = useQuery({
    queryKey: colleaguesQueryKey(search),
    queryFn: () => searchColleagues(search),
  });

  const mutation = useMutation({
    mutationFn: ({ request, key }: CommandAttempt) => createKudo(request, key),
    onSuccess: async (response) => {
      setSuccess(response);
      setDraft(emptyDraft);
      setErrors({});
      setRecoveryCommand(null);
      setIdempotencyKey(newIdempotencyKey());
      if (compact) setExpanded(false);
      await updateWalletOverviewAfterKudo(queryClient, response);
      await queryClient.invalidateQueries({ queryKey: feedQueryKey });
    },
    onError: async (error, attempt) => {
      setSuccess(null);
      if (requiresExactRetry(error)) {
        setRecoveryCommand(attempt);
      } else {
        setRecoveryCommand(null);
        setIdempotencyKey(newIdempotencyKey());
      }
      if (error instanceof ApiClientError) {
        if (error.fieldErrors) {
          const serverErrors: DraftErrors = {};
          for (const field of [
            'receiverId',
            'coreValueId',
            'points',
            'description',
          ] as const) {
            const message = error.fieldErrors[field];
            if (message) {
              serverErrors[field] = message;
            }
          }
          setErrors((current) => ({ ...current, ...serverErrors }));
          focusFirstInvalidField(serverErrors);
        }
        if (error.code === 'INSUFFICIENT_GIVING_BUDGET') {
          await queryClient.invalidateQueries({
            queryKey: walletOverviewQueryKey,
          });
        }
        if (error.code === 'CORE_VALUE_UNAVAILABLE') {
          await queryClient.invalidateQueries({
            queryKey: coreValuesQueryKey,
          });
          const refreshed =
            queryClient.getQueryData<CoreValuesResponse>(coreValuesQueryKey);
          if (
            refreshed &&
            !refreshed.items.some(
              (coreValue) => coreValue.id === attempt.request.coreValueId,
            )
          ) {
            setDraft((current) => ({ ...current, coreValueId: '' }));
            setErrors((current) => ({
              ...current,
              coreValueId: 'Choose an active Core Value.',
            }));
            focusFirstInvalidField({
              coreValueId: 'Choose an active Core Value.',
            });
          }
        }
      }
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  useEffect(() => {
    if (expanded && compact) {
      document.getElementById('colleague-search')?.focus();
    }
  }, [compact, expanded]);

  if (session.status !== 'authenticated') {
    return null;
  }

  const colleagues: ColleagueSearchResponse['items'] =
    colleaguesQuery.data?.items.filter(
      (colleague) => colleague.id !== currentEmployeeId,
    ) ?? [];
  const exhausted =
    budgetQuery.data !== undefined &&
    budgetQuery.data.givingBudget.remaining < 10;
  const fieldsLocked = mutation.isPending || recoveryCommand !== null;

  function updateDraft<Field extends keyof Draft>(
    field: Field,
    value: Draft[Field],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccess(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) {
      return;
    }
    if (recoveryCommand) {
      submitting.current = true;
      mutation.mutate(recoveryCommand);
      return;
    }
    const validation = validateDraft(draft, currentEmployeeId);
    setErrors(validation.errors);
    if (!validation.request || exhausted) {
      focusFirstInvalidField(validation.errors);
      return;
    }
    submitting.current = true;
    mutation.mutate({ request: validation.request, key: idempotencyKey });
  }

  return (
    <div
      className={
        showBudgetSummary ? 'recognition-grid' : 'gj-dashboard-composer min-w-0'
      }
    >
      {showBudgetSummary && (
        <GivingBudgetCard
          overview={budgetQuery.data}
          isPending={budgetQuery.isPending}
          isError={budgetQuery.isError}
          onRetry={() => void budgetQuery.refetch()}
        />
      )}

      <section
        className={
          showBudgetSummary
            ? 'composer-card'
            : 'composer-card rounded-gj-lg border border-gj-border bg-white p-[clamp(1.25rem,3vw,2rem)] shadow-gj-card'
        }
        aria-labelledby="give-kudo-title"
        data-dashboard-composer={!showBudgetSummary || undefined}
      >
        {compact && !expanded ? (
          <div className="flex items-center gap-4 max-mobile:flex-wrap">
            <Avatar
              name={session.currentUser.user.displayName}
              src={session.currentUser.user.avatarUrl}
              size="large"
            />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Recognition</p>
              <h2
                className="m-0 text-gj-lg font-bold text-gj-brand-700"
                id="give-kudo-title"
              >
                Have someone to celebrate?
              </h2>
              <p className="mt-1 mb-0 text-gj-sm text-gj-text-secondary">
                Give a Kudo for work that made a difference.
              </p>
            </div>
            <Button
              ref={compactTrigger}
              className="max-mobile:w-full"
              aria-expanded="false"
              aria-controls="give-kudo-form"
              onClick={() => setExpanded(true)}
            >
              Give a Kudo
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Recognition</p>
                <h2
                  className="m-0 text-gj-2xl font-bold text-gj-brand-700"
                  id="give-kudo-title"
                >
                  Give a Kudo
                </h2>
              </div>
              {compact && (
                <Button
                  variant="ghost"
                  aria-expanded="true"
                  aria-controls="give-kudo-form"
                  onClick={() => {
                    setExpanded(false);
                    setTimeout(() => compactTrigger.current?.focus(), 0);
                  }}
                >
                  Close
                </Button>
              )}
            </div>

            {exhausted && (
              <div role="status" className="blocked-message">
                Your Giving Budget is exhausted for this business month.
              </div>
            )}
            {success && (
              <div role="status" className="success-message">
                Kudo committed for {success.kudo.points} points.
              </div>
            )}
            {mutation.isError && (
              <div role="alert">{commandErrorMessage(mutation.error)}</div>
            )}

            <form id="give-kudo-form" onSubmit={submit} noValidate>
              <label htmlFor="colleague-search">Find a colleague</label>
              <input
                id="colleague-search"
                value={search}
                disabled={fieldsLocked}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or team"
              />
              {colleaguesQuery.isPending ? (
                <p role="status">Loading colleagues…</p>
              ) : colleaguesQuery.isError ? (
                <div role="alert">
                  Colleagues are temporarily unavailable.
                  <button
                    type="button"
                    onClick={() => void colleaguesQuery.refetch()}
                  >
                    Retry colleagues
                  </button>
                </div>
              ) : colleagues.length === 0 ? (
                <p role="status">No matching colleagues.</p>
              ) : null}

              <label htmlFor="receiver">Colleague</label>
              <select
                id="receiver"
                value={draft.receiverId}
                disabled={fieldsLocked}
                aria-invalid={Boolean(errors.receiverId)}
                aria-describedby={
                  errors.receiverId ? 'receiver-error' : undefined
                }
                onChange={(event) =>
                  updateDraft('receiverId', event.target.value)
                }
              >
                <option value="">Choose a colleague</option>
                {colleagues.map((colleague) => (
                  <option key={colleague.id} value={colleague.id}>
                    {colleague.displayName}
                    {colleague.teamName ? ` · ${colleague.teamName}` : ''}
                  </option>
                ))}
              </select>
              {errors.receiverId && (
                <p id="receiver-error" className="field-error">
                  {errors.receiverId}
                </p>
              )}

              <label htmlFor="core-value">Core Value</label>
              <select
                id="core-value"
                value={draft.coreValueId}
                disabled={
                  fieldsLocked ||
                  coreValuesQuery.isPending ||
                  coreValuesQuery.isError
                }
                aria-invalid={Boolean(errors.coreValueId)}
                aria-describedby={
                  errors.coreValueId
                    ? 'core-value-error'
                    : coreValuesQuery.isPending
                      ? 'core-values-loading'
                      : undefined
                }
                onChange={(event) =>
                  updateDraft('coreValueId', event.target.value)
                }
              >
                <option value="">Choose a Core Value</option>
                {coreValuesQuery.data?.items.map((coreValue) => (
                  <option key={coreValue.id} value={coreValue.id}>
                    {coreValue.name}
                  </option>
                ))}
              </select>
              {coreValuesQuery.isPending ? (
                <p id="core-values-loading" role="status">
                  Loading Core Values…
                </p>
              ) : coreValuesQuery.isError ? (
                <div role="alert">
                  Core Values are temporarily unavailable.
                  <button
                    type="button"
                    onClick={() => void coreValuesQuery.refetch()}
                  >
                    Retry Core Values
                  </button>
                </div>
              ) : coreValuesQuery.data?.items.length === 0 ? (
                <p role="status">No active Core Values.</p>
              ) : null}
              {errors.coreValueId && (
                <p id="core-value-error" className="field-error">
                  {errors.coreValueId}
                </p>
              )}

              <label htmlFor="points">Giving Points</label>
              <input
                id="points"
                type="number"
                min="10"
                max="50"
                step="10"
                value={draft.points}
                disabled={fieldsLocked}
                aria-invalid={Boolean(errors.points)}
                aria-describedby={errors.points ? 'points-error' : undefined}
                onChange={(event) => updateDraft('points', event.target.value)}
              />
              {errors.points && (
                <p id="points-error" className="field-error">
                  {errors.points}
                </p>
              )}

              <label htmlFor="description">Why are you recognizing them?</label>
              <textarea
                id="description"
                value={draft.description}
                disabled={fieldsLocked}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description ? 'description-error' : undefined
                }
                onChange={(event) =>
                  updateDraft('description', event.target.value)
                }
              />
              {errors.description && (
                <p id="description-error" className="field-error">
                  {errors.description}
                </p>
              )}

              <AttachmentPicker
                attachmentIds={draft.attachmentIds}
                disabled={fieldsLocked}
                onChange={(attachmentIds) =>
                  updateDraft('attachmentIds', attachmentIds)
                }
              />

              <button
                type="submit"
                disabled={
                  mutation.isPending ||
                  exhausted ||
                  budgetQuery.isPending ||
                  budgetQuery.isError ||
                  coreValuesQuery.isPending ||
                  coreValuesQuery.isError ||
                  coreValuesQuery.data?.items.length === 0
                }
              >
                {mutation.isPending
                  ? 'Sending Kudo…'
                  : recoveryCommand
                    ? 'Retry safely'
                    : 'Give Kudo'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
