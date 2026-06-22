const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/;

export function toUserErrorMessage(reason: unknown, fallback = '処理に失敗しました。') {
  const message = reason instanceof Error ? reason.message.trim() : '';

  if (JAPANESE_TEXT_PATTERN.test(message)) return message;
  if (/failed to fetch|network request failed|fetch failed/i.test(message)) {
    return 'サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください。';
  }
  if (/timeout|timed out/i.test(message)) {
    return '通信がタイムアウトしました。もう一度お試しください。';
  }

  return fallback;
}
