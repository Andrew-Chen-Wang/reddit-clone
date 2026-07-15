"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { Button } from "./button"

function LoadingButton({
  loading,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { loading?: boolean }) {
  const { pending } = useFormStatus()

  const isLoading = loading ?? pending

  return (
    <Button disabled={isLoading} {...props}>
      {isLoading ? "Please wait" : children}
      {isLoading && <Loader2Icon className="ml-2 size-4 animate-spin" />}
    </Button>
  )
}

export { LoadingButton }
