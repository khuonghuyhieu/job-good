export function notificationLabel(type: string): string {
  const labels: Record<string, string> = {
    'kudo.received': 'You received a Kudo',
    'comment.created': 'New comment',
    'reaction.changed': 'New reaction',
    'reward.redeemed': 'Reward redeemed',
  };
  return labels[type] ?? 'Good Job update';
}
