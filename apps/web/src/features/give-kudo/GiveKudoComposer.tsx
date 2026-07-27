import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
import {
  Avatar,
  Button,
  ErrorState,
  Field,
  TextArea,
  TextInput,
} from '../../shared/ui/index.js';
import { useDialogAccessibility } from '../../shared/ui/use-dialog-accessibility.js';

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

const pointOptions = [10, 20, 30, 40, 50] as const;

function ComposerSurface({
  dialog,
  onClose,
  children,
  dashboard,
}: {
  dialog: boolean;
  onClose: () => void;
  children: ReactNode;
  dashboard: boolean;
}) {
  const surface = useRef<HTMLElement>(null);
  useDialogAccessibility({
    open: dialog,
    containerRef: surface,
    onClose,
  });
  const content = (
    <section
      ref={surface}
      className={
        dialog
          ? 'min-w-0 max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-gj-lg border border-gj-border bg-white p-[clamp(1.25rem,3vw,2rem)] shadow-gj-popover max-mobile:max-h-none max-mobile:h-full max-mobile:rounded-none'
          : 'min-w-0 rounded-gj-lg border border-gj-border bg-white p-[clamp(1.25rem,3vw,2rem)] shadow-gj-card'
      }
      aria-labelledby="give-kudo-title"
      data-dashboard-composer={dashboard || undefined}
      {...(dialog ? { role: 'dialog', 'aria-modal': true, tabIndex: -1 } : {})}
    >
      {children}
    </section>
  );
  return dialog
    ? createPortal(
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-gj-overlay p-4 max-mobile:p-0"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          {content}
        </div>,
        document.body,
      )
    : content;
}

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
    const selector = {
      receiverId: '#receiver-group input[type="radio"]:not(:disabled)',
      coreValueId: '#core-value-group input[type="radio"]:not(:disabled)',
      points: '#points-group input[type="radio"]:not(:disabled)',
      description: '#description',
    }[field];
    const fallbackId = {
      receiverId: 'colleague-search',
      coreValueId: 'core-value-group',
      points: 'points-group',
      description: 'description',
    }[field];
    setTimeout(() => {
      const fieldControl = document.querySelector<HTMLElement>(selector);
      (fieldControl ?? document.getElementById(fallbackId))?.focus();
    }, 0);
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
  const [selectedColleague, setSelectedColleague] = useState<
    ColleagueSearchResponse['items'][number] | null
  >(null);
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
      setSelectedColleague(null);
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

  if (session.status !== 'authenticated') {
    return null;
  }

  const colleagues: ColleagueSearchResponse['items'] =
    colleaguesQuery.data?.items.filter(
      (colleague) => colleague.id !== currentEmployeeId,
    ) ?? [];
  const displayedColleagues =
    selectedColleague &&
    !colleagues.some((colleague) => colleague.id === selectedColleague.id)
      ? [selectedColleague, ...colleagues]
      : colleagues;
  const exhausted =
    budgetQuery.data !== undefined &&
    budgetQuery.data.givingBudget.remaining < 10;
  const fieldsLocked = mutation.isPending || recoveryCommand !== null;
  const closeComposer = () => {
    if (fieldsLocked) return;
    setExpanded(false);
    requestAnimationFrame(() => compactTrigger.current?.focus());
  };

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
        showBudgetSummary
          ? 'mx-auto grid w-full max-w-5xl grid-cols-[minmax(13.75rem,0.75fr)_minmax(0,1.5fr)] items-start gap-6 max-mobile:grid-cols-1'
          : 'gj-dashboard-composer min-w-0'
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

      <ComposerSurface
        dialog={compact && expanded}
        onClose={closeComposer}
        dashboard={!showBudgetSummary}
      >
        {success && (
          <div
            role="status"
            className="mb-5 rounded-gj-md border border-gj-success/20 bg-gj-success-subtle p-4 text-gj-sm font-semibold text-gj-success"
          >
            Kudo committed for {success.kudo.points} points.
          </div>
        )}
        {compact && !expanded ? (
          <div className="flex items-center gap-4 max-mobile:flex-wrap">
            <Avatar
              name={session.currentUser.user.displayName}
              src={session.currentUser.user.avatarUrl}
              size="large"
            />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-gj-xs font-extrabold tracking-[0.12em] text-gj-primary-600 uppercase">
                Recognition
              </p>
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
                <p className="m-0 text-gj-xs font-extrabold tracking-[0.12em] text-gj-primary-600 uppercase">
                  Recognition
                </p>
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
                    closeComposer();
                  }}
                >
                  Close
                </Button>
              )}
            </div>

            {exhausted && (
              <div
                role="status"
                className="mt-5 rounded-gj-md border border-gj-warning/25 bg-gj-warning-subtle p-4 text-gj-sm font-semibold text-gj-warning"
              >
                Your Giving Budget is exhausted for this business month.
              </div>
            )}
            {mutation.isError && (
              <div
                role="alert"
                className="mt-5 rounded-gj-md border border-gj-danger/20 bg-gj-danger-subtle p-4 text-gj-sm text-gj-danger"
              >
                {commandErrorMessage(mutation.error)}
              </div>
            )}

            <form
              className="mt-6 grid gap-6"
              id="give-kudo-form"
              onSubmit={submit}
              noValidate
            >
              <Field id="colleague-search" label="Find a colleague">
                <TextInput
                  id="colleague-search"
                  value={search}
                  disabled={fieldsLocked}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or team"
                />
              </Field>
              {colleaguesQuery.isPending ? (
                <p
                  className="m-0 text-gj-sm text-gj-text-secondary"
                  role="status"
                >
                  Loading colleagues…
                </p>
              ) : colleaguesQuery.isError ? (
                <ErrorState
                  title="Colleagues are temporarily unavailable"
                  actionLabel="Retry colleagues"
                  onAction={() => void colleaguesQuery.refetch()}
                />
              ) : colleagues.length === 0 ? (
                <p
                  className="m-0 rounded-gj-md bg-gj-surface-subtle p-4 text-gj-sm text-gj-text-secondary"
                  role="status"
                >
                  No matching colleagues.
                </p>
              ) : null}

              <div className="grid gap-3">
                <span className="text-gj-sm font-bold text-gj-brand-700">
                  Colleague
                </span>
                <div
                  className="grid grid-cols-2 gap-3 rounded-gj-sm max-mobile:grid-cols-1 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gj-focus"
                  role="radiogroup"
                  aria-label="Choose a colleague"
                  aria-invalid={Boolean(errors.receiverId)}
                  aria-describedby={
                    errors.receiverId ? 'receiver-error' : undefined
                  }
                  id="receiver-group"
                  tabIndex={-1}
                >
                  {displayedColleagues.map((colleague) => {
                    const selected = draft.receiverId === colleague.id;
                    return (
                      <label
                        key={colleague.id}
                        className={
                          selected
                            ? 'relative flex min-h-16 cursor-pointer items-center gap-3 rounded-gj-md border-2 border-gj-primary-600 bg-gj-primary-100 p-3 text-left text-gj-text shadow-sm'
                            : 'relative flex min-h-16 cursor-pointer items-center gap-3 rounded-gj-md border border-gj-border bg-white p-3 text-left text-gj-text transition hover:border-gj-primary-500 hover:bg-gj-surface-subtle'
                        }
                      >
                        <input
                          className="peer sr-only"
                          type="radio"
                          name="receiver"
                          aria-label={`${colleague.displayName}${
                            colleague.teamName ? ` ${colleague.teamName}` : ''
                          }`}
                          value={colleague.id}
                          checked={selected}
                          disabled={fieldsLocked}
                          onChange={() => {
                            setSelectedColleague(colleague);
                            updateDraft('receiverId', colleague.id);
                          }}
                        />
                        <span className="pointer-events-none absolute inset-0 rounded-gj-md peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gj-focus" />
                        <Avatar
                          name={colleague.displayName}
                          src={colleague.avatarUrl}
                          size="medium"
                        />
                        <span className="min-w-0">
                          <strong className="block truncate text-gj-sm">
                            {colleague.displayName}
                          </strong>
                          <span className="block truncate text-gj-xs text-gj-text-secondary">
                            {colleague.teamName ?? 'Good Job colleague'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {errors.receiverId && (
                <p
                  id="receiver-error"
                  className="m-0 text-gj-sm font-semibold text-gj-danger"
                >
                  {errors.receiverId}
                </p>
              )}

              <div className="grid gap-3">
                <span className="text-gj-sm font-bold text-gj-brand-700">
                  Core Value
                </span>
                <div
                  className="grid grid-cols-2 gap-3 rounded-gj-sm max-mobile:grid-cols-1 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gj-focus"
                  role="radiogroup"
                  aria-label="Choose a Core Value"
                  aria-invalid={Boolean(errors.coreValueId)}
                  aria-describedby={
                    errors.coreValueId
                      ? 'core-value-error'
                      : coreValuesQuery.isPending
                        ? 'core-values-loading'
                        : undefined
                  }
                  id="core-value-group"
                  tabIndex={-1}
                >
                  {coreValuesQuery.data?.items.map((coreValue) => {
                    const selected = draft.coreValueId === coreValue.id;
                    return (
                      <label
                        key={coreValue.id}
                        className={
                          selected
                            ? 'relative cursor-pointer rounded-gj-md border-2 border-gj-primary-600 bg-gj-primary-100 p-4 text-left text-gj-text'
                            : 'relative cursor-pointer rounded-gj-md border border-gj-border bg-white p-4 text-left text-gj-text transition hover:border-gj-primary-500 hover:bg-gj-surface-subtle'
                        }
                      >
                        <input
                          className="peer sr-only"
                          type="radio"
                          name="coreValue"
                          aria-label={coreValue.name}
                          value={coreValue.id}
                          checked={selected}
                          disabled={fieldsLocked}
                          onChange={() =>
                            updateDraft('coreValueId', coreValue.id)
                          }
                        />
                        <span className="pointer-events-none absolute inset-0 rounded-gj-md peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gj-focus" />
                        <strong className="block text-gj-sm text-gj-brand-700">
                          {coreValue.name}
                        </strong>
                        {coreValue.description && (
                          <span className="mt-1 block text-gj-xs text-gj-text-secondary">
                            {coreValue.description}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
              {coreValuesQuery.isPending ? (
                <p
                  className="m-0 text-gj-sm text-gj-text-secondary"
                  id="core-values-loading"
                  role="status"
                >
                  Loading Core Values…
                </p>
              ) : coreValuesQuery.isError ? (
                <ErrorState
                  title="Core Values are temporarily unavailable"
                  actionLabel="Retry Core Values"
                  onAction={() => void coreValuesQuery.refetch()}
                />
              ) : coreValuesQuery.data?.items.length === 0 ? (
                <p
                  className="m-0 rounded-gj-md bg-gj-surface-subtle p-4 text-gj-sm text-gj-text-secondary"
                  role="status"
                >
                  No active Core Values.
                </p>
              ) : null}
              {errors.coreValueId && (
                <p
                  id="core-value-error"
                  className="m-0 text-gj-sm font-semibold text-gj-danger"
                >
                  {errors.coreValueId}
                </p>
              )}

              <fieldset
                className="m-0 grid gap-3 rounded-gj-sm border-0 p-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gj-focus"
                aria-invalid={Boolean(errors.points)}
                aria-describedby={errors.points ? 'points-error' : undefined}
                id="points-group"
                tabIndex={-1}
              >
                <legend className="text-gj-sm font-bold text-gj-brand-700">
                  Giving Points
                </legend>
                <div className="grid grid-cols-5 gap-2 max-mobile:grid-cols-3">
                  {pointOptions.map((points) => (
                    <label
                      key={points}
                      className={
                        draft.points === String(points)
                          ? 'relative grid min-h-11 cursor-pointer place-items-center rounded-full border-2 border-gj-primary-600 bg-gj-primary-600 px-3 font-bold text-white'
                          : 'relative grid min-h-11 cursor-pointer place-items-center rounded-full border border-gj-control-border bg-white px-3 font-bold text-gj-brand-700 hover:border-gj-primary-600'
                      }
                    >
                      <input
                        className="peer sr-only"
                        type="radio"
                        name="points"
                        value={points}
                        checked={draft.points === String(points)}
                        disabled={fieldsLocked}
                        onChange={() => updateDraft('points', String(points))}
                      />
                      <span className="pointer-events-none absolute inset-0 rounded-full peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gj-focus" />
                      <span>{points}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {errors.points && (
                <p
                  id="points-error"
                  className="m-0 text-gj-sm font-semibold text-gj-danger"
                >
                  {errors.points}
                </p>
              )}

              <Field
                id="description"
                label="Why are you recognizing them?"
                hint="Describe the contribution and the difference it made."
                {...(errors.description ? { error: errors.description } : {})}
              >
                <TextArea
                  id="description"
                  value={draft.description}
                  disabled={fieldsLocked}
                  onChange={(event) =>
                    updateDraft('description', event.target.value)
                  }
                  placeholder="Share a specific, meaningful contribution…"
                />
              </Field>

              <AttachmentPicker
                attachmentIds={draft.attachmentIds}
                disabled={fieldsLocked}
                onChange={(attachmentIds) =>
                  updateDraft('attachmentIds', attachmentIds)
                }
              />

              <Button
                type="submit"
                pending={mutation.isPending}
                pendingLabel="Sending Kudo…"
                className="w-full"
                disabled={
                  exhausted ||
                  budgetQuery.isPending ||
                  budgetQuery.isError ||
                  coreValuesQuery.isPending ||
                  coreValuesQuery.isError ||
                  coreValuesQuery.data?.items.length === 0
                }
              >
                {recoveryCommand ? 'Retry safely' : 'Give Kudo'}
              </Button>
            </form>
          </>
        )}
      </ComposerSurface>
    </div>
  );
}
