import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { RadioGroup, RadioGroupItem } from "@ui/base/ui/radio-group"
import { useTheme, type Theme } from "@ui/spa-shared/theme"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1UserMeOptions,
  getApiV1UserMeSettingsOptions,
  patchApiV1UserMeSettingsMutation,
  postApiV1AuthLogoutMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { LogOut, Monitor, Moon, Plus, Search, Settings, Sun, User } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

type DisplayMode = "auto" | "light" | "dark"

const THEME_FROM_MODE: Record<DisplayMode, Theme> = {
  auto: "system",
  light: "light",
  dark: "dark",
}

const MODE_OPTIONS: { value: DisplayMode; label: string; icon: typeof Sun }[] = [
  { value: "auto", label: "Auto", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
]

function DisplayModeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { setTheme } = useTheme()
  const queryClient = useQueryClient()
  const { data: settings } = useQuery({
    ...getApiV1UserMeSettingsOptions(),
    enabled: open,
  })
  const mutation = useMutation({
    ...patchApiV1UserMeSettingsMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1UserMeSettingsOptions().queryKey })
    },
    onError: () => {
      toast.error("Could not save display mode")
    },
  })

  const current = (settings?.displayMode as DisplayMode | undefined) ?? "auto"

  const handleChange = (next: string) => {
    const mode = next as DisplayMode
    setTheme(THEME_FROM_MODE[mode])
    mutation.mutate({ body: { displayMode: mode } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Display mode</DialogTitle>
          <DialogDescription>Choose how ReadIt looks to you.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={current} onValueChange={handleChange} className="gap-2">
          {MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
            <Label
              key={value}
              htmlFor={`display-${value}`}
              className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent"
            >
              <RadioGroupItem id={`display-${value}`} value={value} />
              <Icon className="size-4" />
              <span>{label}</span>
            </Label>
          ))}
        </RadioGroup>
      </DialogContent>
    </Dialog>
  )
}

export function TopNav() {
  const navigate = useNavigate()
  const [displayOpen, setDisplayOpen] = useState(false)
  const { data: user } = useQuery(getApiV1UserMeOptions())

  const logout = useMutation({
    ...postApiV1AuthLogoutMutation(),
    onSuccess: () => {
      window.location.href = `${import.meta.env.VITE_NEXTJS_URL ?? ""}/`
    },
  })

  const initial = (user?.displayName ?? user?.username ?? "?").charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link to="/" className="text-lg font-bold text-primary">
          ReadIt
        </Link>
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search ReadIt"
            aria-label="Search"
            className="pl-9"
            disabled
          />
        </div>
        <Link
          to="/submit"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-auto gap-1.5")}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Create</span>
        </Link>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full")}
            >
              <Avatar className="size-8">
                {user?.avatarImageKey ? (
                  <AvatarImage src={mediaUrl(user.avatarImageKey) ?? undefined} alt="" />
                ) : null}
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user ? (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">u/{user.username}</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem
                disabled={!user}
                onClick={() => {
                  if (user)
                    void navigate({ to: "/u/$username", params: { username: user.username } })
                }}
              >
                <User className="size-4" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void navigate({ to: "/settings" })}>
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setDisplayOpen(true)
                }}
              >
                <Monitor className="size-4" />
                Display Mode
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={logout.isPending}
                onClick={() => {
                  void logout.mutateAsync({})
                }}
              >
                <LogOut className="size-4" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <DisplayModeDialog open={displayOpen} onOpenChange={setDisplayOpen} />
    </header>
  )
}
