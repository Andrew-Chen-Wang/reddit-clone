import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getApiV1CommunityByIdSettingsOptions,
  getApiV1CommunityByNameOptions,
  patchApiV1CommunityByIdMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import type {
  GetApiV1CommunityByIdSettingsResponses,
  PatchApiV1CommunityByIdData,
} from "@lib/api-client/generated/types.gen"
import { toast } from "sonner"

export type CommunitySettingsBody = NonNullable<PatchApiV1CommunityByIdData["body"]>

/** Full community settings (every column the PATCH accepts, one-to-one). */
export type CommunityWithSettings = GetApiV1CommunityByIdSettingsResponses[200]

/**
 * Loads a community's full settings for the mod settings pages and returns an
 * immediate-save PATCH helper. The name is resolved to an id via the community
 * detail query (also used for the guard/aggregate), then settings are fetched
 * from the dedicated mod-only endpoint. The aggregate "mod" view has no single
 * community, so nothing is loaded there.
 */
export function useCommunitySettings(name: string) {
  const queryClient = useQueryClient()
  const aggregate = name === "mod"

  const communityOptions = getApiV1CommunityByNameOptions({ path: { name } })
  const communityQuery = useQuery({ ...communityOptions, enabled: !aggregate })
  const communityId = communityQuery.data?.id ?? null

  const settingsOptions = getApiV1CommunityByIdSettingsOptions({ path: { id: communityId ?? "" } })
  const settingsQuery = useQuery({
    ...settingsOptions,
    enabled: !aggregate && communityId !== null,
  })
  const community = settingsQuery.data

  const mutation = useMutation({
    ...patchApiV1CommunityByIdMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsOptions.queryKey })
      void queryClient.invalidateQueries({ queryKey: communityOptions.queryKey })
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
    communityId,
    isLoading: communityQuery.isLoading || settingsQuery.isLoading,
    aggregate,
    save,
    saving: mutation.isPending,
  }
}
