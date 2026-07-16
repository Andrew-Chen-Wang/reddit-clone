"use client"

import type { ReactNode } from "react"
import { useRef, useState } from "react"
import { Bold, Code, Eye, Italic, Link2, List, Pencil } from "lucide-react"
import { cn } from "@ui/base/lib/utils"
import { Button } from "@ui/base/ui/button"
import { Textarea } from "@ui/base/ui/textarea"

export type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minRows?: number
  className?: string
  /** Renders the markdown preview. Supplied by the host so this package stays SEO-agnostic. */
  renderPreview?: (markdown: string) => ReactNode
  id?: string
}

type Wrap = { before: string; after: string; placeholder: string }

const BOLD: Wrap = { before: "**", after: "**", placeholder: "bold text" }
const ITALIC: Wrap = { before: "_", after: "_", placeholder: "italic text" }
const CODE: Wrap = { before: "`", after: "`", placeholder: "code" }
const LINK: Wrap = { before: "[", after: "](https://)", placeholder: "link text" }

/**
 * Minimal markdown editor: a small formatting toolbar that inserts markdown syntax
 * plus a write/preview toggle. Intentionally not a rich-text editor — a ProseMirror
 * RTE is deferred to a later milestone. Framework-agnostic; the host passes
 * `renderPreview` to render the markdown (e.g. seo-shared's <Markdown>).
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Text (optional)",
  minRows = 6,
  className,
  renderPreview,
  id,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [mode, setMode] = useState<"write" | "preview">("write")

  function applyWrap(wrap: Wrap) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || wrap.placeholder
    const next = `${value.slice(0, start)}${wrap.before}${selected}${wrap.after}${value.slice(end)}`
    onChange(next)
    const cursorStart = start + wrap.before.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursorStart, cursorStart + selected.length)
    })
  }

  function applyLinePrefix(prefix: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  return (
    <div className={cn("rounded-md border", className)}>
      <div className="flex items-center gap-0.5 border-b p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Bold"
          disabled={mode === "preview"}
          onClick={() => {
            applyWrap(BOLD)
          }}
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Italic"
          disabled={mode === "preview"}
          onClick={() => {
            applyWrap(ITALIC)
          }}
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Link"
          disabled={mode === "preview"}
          onClick={() => {
            applyWrap(LINK)
          }}
        >
          <Link2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Code"
          disabled={mode === "preview"}
          onClick={() => {
            applyWrap(CODE)
          }}
        >
          <Code className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Bulleted list"
          disabled={mode === "preview"}
          onClick={() => {
            applyLinePrefix("- ")
          }}
        >
          <List className="size-4" />
        </Button>
        {renderPreview ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => {
              setMode((m) => (m === "write" ? "preview" : "write"))
            }}
          >
            {mode === "write" ? (
              <>
                <Eye className="size-4" />
                Preview
              </>
            ) : (
              <>
                <Pencil className="size-4" />
                Edit
              </>
            )}
          </Button>
        ) : null}
      </div>
      {mode === "write" ? (
        <Textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
          }}
          placeholder={placeholder}
          rows={minRows}
          className="resize-y border-0 focus-visible:ring-0"
        />
      ) : (
        <div className="min-h-24 p-3">
          {value.trim() ? (
            renderPreview?.(value)
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview</p>
          )}
        </div>
      )}
    </div>
  )
}
