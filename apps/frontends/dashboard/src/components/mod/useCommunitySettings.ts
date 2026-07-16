import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getApiV1CommunityByNameOptions,
  patchApiV1CommunityByIdMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import type {
  GetApiV1CommunityByNameResponses,
  PatchApiV1CommunityByIdData,
} from "@lib/api-client/generated/types.gen"
import { toast } from "sonner"

export type CommunitySettingsBody = NonNullable<PatchApiV1CommunityByIdData["body"]>

/**
 * The community detail response currently only surfaces a subset of settings
 * columns. Until the serializer exposes the rest, treat the extra columns the
 * PATCH accepts as optionally present, so forms prefill correctly the moment the
 * backend adds them. See the note sent to m8-backend.
 */
export type CommunityWithSettings = GetApiV1CommunityByNameResponses[200] &
  Partial<CommunitySettingsBody>

/**
 * Loads a community for the mod settings pages and returns an immediate-save
 * PATCH helper that revalidates the detail query and toasts on completion.
 */
export function useCommunitySettings(name: string) {
  const queryClient = useQueryClient()
  const options = getApiV1CommunityByNameOptions({ path: { name } })
  const query = useQuery({ ...options, enabled: name !== "mod" })
  const community = query.data as CommunityWithSettings | undefined

  const mutation = useMutation({
    ...patchApiV1CommunityByIdMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: options.queryKey })
      toast.success("Settings saved")
    },
    onError: () => {
      toast.error("Could not save settings")
    },
  })

  const save = (body: CommunitySettingsBody) => {
    if (!community) return
    mutation.mutate({ path: { id: community.id }, body })
  }

  return {
    community,
    communityId: community?.id ?? null,
    isLoading: query.isLoading,
    aggregate: name === "mod",
    save,
    saving: mutation.isPending,
  }
}
