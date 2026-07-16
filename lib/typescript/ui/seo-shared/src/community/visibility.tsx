import { Globe, Lock, Shield } from "lucide-react"
import type { ComponentType } from "react"

export type CommunityVisibility = "public" | "restricted" | "private"

type VisibilityMeta = {
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}

const META: Record<CommunityVisibility, VisibilityMeta> = {
  public: {
    label: "Public",
    description: "Anyone can view, post, and comment to this community",
    icon: Globe,
  },
  restricted: {
    label: "Restricted",
    description: "Anyone can view, but only approved users can contribute",
    icon: Shield,
  },
  private: {
    label: "Private",
    description: "Only approved users can view and contribute to this community",
    icon: Lock,
  },
}

export function visibilityMeta(visibility: string): VisibilityMeta {
  return META[
    (visibility as CommunityVisibility) in META ? (visibility as CommunityVisibility) : "public"
  ]
}
