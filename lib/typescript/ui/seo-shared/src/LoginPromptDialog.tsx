"use client"

import { buttonVariants } from "@ui/base/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"

export type LoginPromptDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where the "Log In" button navigates. Full navigation works in SSR and SPA. */
  loginHref?: string
  title?: string
  description?: string
}

/**
 * Shown when an anonymous visitor tries an action that requires an account (voting,
 * commenting, etc.). Presentational + controlled — the caller owns the open state.
 */
export function LoginPromptDialog({
  open,
  onOpenChange,
  loginHref = "/login",
  title = "Log in to continue",
  description = "You need an account to do that. Log in or sign up to join the conversation.",
}: LoginPromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          {/* oxlint-disable-next-line no-html-link-for-pages -- /login is a Next.js page outside the SPA router */}
          <a href={loginHref} className={buttonVariants()}>
            Log In
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
