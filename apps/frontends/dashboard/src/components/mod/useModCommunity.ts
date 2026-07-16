import { useQuery } from "@tanstack/react-query"
import { getApiV1CommunityByNameOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"

/**
 * Resolves the community for a mod-tools child route from its `name` param.
 * The aggregate "mod" view has no single community, so `communityId` is null there.
 */
export function useModCommunity(name: string) {
  const aggregate = name === "mod"
  const query = useQuery({
    ...getApiV1CommunityByNameOptions({ path: { name } }),
    enabled: !aggregate,
  })
  return {
    aggregate,
    community: query.data,
    communityId: aggregate ? null : (query.data?.id ?? null),
    isLoading: query.isLoading,
  }
}
