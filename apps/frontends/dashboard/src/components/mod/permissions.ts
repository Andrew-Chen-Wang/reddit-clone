export type ModPermKey =
  | "permEverything"
  | "permUsers"
  | "permConfig"
  | "permFlair"
  | "permMail"
  | "permPostsComments"
  | "permWiki"

export type ModPerms = Record<ModPermKey, boolean>

export const MOD_PERMISSIONS: { key: ModPermKey; label: string; description: string }[] = [
  {
    key: "permEverything",
    label: "Everything",
    description: "Full access to all moderator tools.",
  },
  { key: "permUsers", label: "Users", description: "Ban, mute, and approve users." },
  { key: "permConfig", label: "Config", description: "Settings, appearance, emojis, rules." },
  { key: "permFlair", label: "Flair", description: "Manage user and post flair." },
  { key: "permMail", label: "Mail", description: "Read and reply to modmail." },
  {
    key: "permPostsComments",
    label: "Posts & Comments",
    description: "Approve and remove posts and comments.",
  },
  { key: "permWiki", label: "Wiki", description: "Edit the community wiki." },
]

/** Human-readable one-line summary of a moderator's permissions. */
export function permissionSummary(perms: ModPerms): string {
  if (perms.permEverything) return "Everything"
  const active = MOD_PERMISSIONS.filter((p) => p.key !== "permEverything" && perms[p.key])
  if (active.length === 0) return "No permissions"
  return active.map((p) => p.label).join(", ")
}
