import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getApiV1UserMeSettingsOptions,
  patchApiV1UserMeSettingsMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { useState } from "react"

export type ViewMode = "card" | "compact"

/**
 * Card / compact view selection shared across every profile tab. Reads the
 * persisted `feedView` from user settings, allows an in-session override, and
 * writes changes back so the choice sticks (matching PostFeed's behavior).
 */
export function useFeedView() {
  const queryClient = useQueryClient()
  const { data: settings } = useQuery(getApiV1UserMeSettingsOptions())
  const [override, setOverride] = useState<ViewMode | null>(null)
  const view: ViewMode = override ?? (settings?.feedView as ViewMode | undefined) ?? "card"

  const patch = useMutation({
    ...patchApiV1UserMeSettingsMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1UserMeSettingsOptions().queryKey })
    },
  })

  function setView(next: ViewMode) {
    setOverride(next)
    patch.mutate({ body: { feedView: next } })
  }

  return { view, setView }
}
