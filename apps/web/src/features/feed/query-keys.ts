export const feedQueryKey = ['feed'] as const;

export const feedQueryKeys = {
  all: feedQueryKey,
  pages: () => [...feedQueryKey, 'pages'] as const,
  detail: (kudoId: string) => [...feedQueryKey, 'detail', kudoId] as const,
};
