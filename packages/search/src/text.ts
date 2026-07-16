const CODE_FENCE = /```[\s\S]*?```/g
const INLINE_CODE = /`([^`]*)`/g
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g
const LINK = /\[([^\]]*)\]\([^)]*\)/g
const HEADING = /^#{1,6}\s+/gm
const BLOCKQUOTE = /^\s{0,3}>\s?/gm
const LIST_MARKER = /^\s*([-*+]|\d+\.)\s+/gm
const EMPHASIS = /(\*\*|__|\*|_|~~)/g
const HTML_TAG = /<[^>]+>/g
const WHITESPACE = /\s+/g

export function markdownToText(input: string | null | undefined, maxLen?: number): string {
  if (!input) return ""
  const plain = input
    .replace(CODE_FENCE, " ")
    .replace(IMAGE, " ")
    .replace(LINK, "$1")
    .replace(INLINE_CODE, "$1")
    .replace(HEADING, "")
    .replace(BLOCKQUOTE, "")
    .replace(LIST_MARKER, "")
    .replace(EMPHASIS, "")
    .replace(HTML_TAG, " ")
    .replace(WHITESPACE, " ")
    .trim()
  if (maxLen && plain.length > maxLen) {
    return `${plain.slice(0, maxLen).trimEnd()}…`
  }
  return plain
}
