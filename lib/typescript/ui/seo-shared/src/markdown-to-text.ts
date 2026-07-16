import { parse, transform, renderers } from "@markdoc/markdoc"

function decodeBasicEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export function markdownToText(text: string | null | undefined, maxLen?: number): string {
  if (!text) return ""
  const ast = parse(text)
  const content = transform(ast)
  const html = renderers.html(content)
  const plain = decodeBasicEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
  if (maxLen && plain.length > maxLen) {
    return `${plain.slice(0, maxLen).trimEnd()}…`
  }
  return plain
}
