const MENTION_REGEX = /@([a-zA-Z0-9_]{2,30})/g;

export function extractMentionUsernames(text: string): string[] {
  const unique = new Set<string>();
  if (!text) return [];

  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    unique.add(match[1].toLowerCase());
  }

  return Array.from(unique);
}

