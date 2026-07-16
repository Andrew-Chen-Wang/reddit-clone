// Thin indirection over the generated admin API client so that a single file
// needs touching if the generated hook names change after regeneration.
// These names assume admin/index.ts mounts: .route("/users", user)
// .route("/posts", post) .route("/stats", stats)
export {
  getApiAdminStatsOptions,
  getApiAdminUsersOptions,
  getApiAdminUsersQueryKey,
  getApiAdminPostsOptions,
  getApiAdminPostsQueryKey,
  postApiAdminUsersByIdSuspendMutation,
  postApiAdminUsersByIdUnsuspendMutation,
  postApiAdminPostsByIdRemoveMutation,
  postApiAdminPostsByIdRestoreMutation,
} from "@lib/api-client/admin-generated/@tanstack/react-query.gen"
