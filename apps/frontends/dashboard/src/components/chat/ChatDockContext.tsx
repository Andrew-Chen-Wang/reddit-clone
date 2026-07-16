import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

export type DockView = "hidden" | "collapsed" | "open"

export interface ChatDockValue {
  /** True only when a real provider is mounted (lets callers fall back). */
  available: boolean
  view: DockView
  selectedId: string | undefined
  /** Expand the full panel. */
  open: () => void
  /** Shrink to the bottom-right bar. */
  collapse: () => void
  /** Remove the dock entirely (bar included). */
  hide: () => void
  /** Toggle between the expanded panel and the collapsed bar. */
  toggle: () => void
  /** Select a conversation and expand the panel. */
  openConversation: (id: string) => void
  clearSelection: () => void
}

const FALLBACK: ChatDockValue = {
  available: false,
  view: "hidden",
  selectedId: undefined,
  open: () => {},
  collapse: () => {},
  hide: () => {},
  toggle: () => {},
  openConversation: () => {},
  clearSelection: () => {},
}

const ChatDockContext = createContext<ChatDockValue | null>(null)

/**
 * Store controlling the floating chat dock. Returns a no-op fallback when no
 * provider is mounted, so `<ChatButton>` and other callers can safely call
 * `toggle()`/`open()` even before the dock is wired into the root layout.
 */
export function useChatDock(): ChatDockValue {
  return useContext(ChatDockContext) ?? FALLBACK
}

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<DockView>("collapsed")
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const value = useMemo<ChatDockValue>(
    () => ({
      available: true,
      view,
      selectedId,
      open: () => {
        setView("open")
      },
      collapse: () => {
        setView("collapsed")
      },
      hide: () => {
        setView("hidden")
      },
      toggle: () => {
        setView((v) => (v === "open" ? "collapsed" : "open"))
      },
      openConversation: (id: string) => {
        setSelectedId(id)
        setView("open")
      },
      clearSelection: () => {
        setSelectedId(undefined)
      },
    }),
    [view, selectedId],
  )

  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>
}
