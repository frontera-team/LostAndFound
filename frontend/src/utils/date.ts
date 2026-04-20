export function formatReplyDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso || '');
  }
}
