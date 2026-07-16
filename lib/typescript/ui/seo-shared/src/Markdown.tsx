import { parse, transform, renderers } from "@markdoc/markdoc"
import DOMPurify from "isomorphic-dompurify"

import { cn } from "@ui/base/lib/utils"

export type MarkdownProps = {
  content: string | null | undefined
  className?: string
}

export function renderMarkdownToSafeHtml(content: string | null | undefined): string {
  if (!content) return ""
  const ast = parse(content)
  const transformed = transform(ast)
  return DOMPurify.sanitize(renderers.html(transformed))
}

export function Markdown({ content, className }: MarkdownProps) {
  const html = renderMarkdownToSafeHtml(content)
  if (!html) return null
  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
