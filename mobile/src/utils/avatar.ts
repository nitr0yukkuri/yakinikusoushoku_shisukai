export function getAvatarInitials(name?: string) {
  const label = name?.trim();
  if (!label) return '?';

  const words = label.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join('');
  }

  return Array.from(label).slice(0, 2).join('');
}
