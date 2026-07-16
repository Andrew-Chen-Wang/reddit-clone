import { useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"
import { Button } from "@ui/base/ui/button"
import { Label } from "@ui/base/ui/label"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import {
  postApiV1MediaCommunityBannerConfirm,
  postApiV1MediaCommunityBannerUpload,
  postApiV1MediaCommunityIconConfirm,
  postApiV1MediaCommunityIconUpload,
} from "@lib/api-client/generated/sdk.gen"
import { ImageCropDialog } from "@frontends/dashboard/components/ImageCropDialog"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import { uploadToPresigned } from "@frontends/dashboard/lib/mediaUpload"
import { ImagePlus } from "lucide-react"
import { toast } from "sonner"

export type CommunityAppearanceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  communityId: string
  communityName: string
  iconImageKey: string | null
  bannerImageKey: string | null
  /** Invalidate the community query after a successful change. */
  onUpdated: () => void
}

type Target = "icon" | "banner"

export function CommunityAppearanceDialog({
  open,
  onOpenChange,
  communityId,
  communityName,
  iconImageKey,
  bannerImageKey,
  onUpdated,
}: CommunityAppearanceDialogProps) {
  const [target, setTarget] = useState<Target | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const iconInputRef = useRef<HTMLInputElement | null>(null)
  const bannerInputRef = useRef<HTMLInputElement | null>(null)

  function pickFile(next: Target, files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    setPendingFile(file)
    setTarget(next)
  }

  async function uploadCropped(blob: Blob) {
    if (!target) return
    setUploading(true)
    try {
      const body = { communityId, mimeType: "image/png" as const, byteSize: blob.size }
      const { data } =
        target === "icon"
          ? await postApiV1MediaCommunityIconUpload({ body, throwOnError: true })
          : await postApiV1MediaCommunityBannerUpload({ body, throwOnError: true })
      await uploadToPresigned({ url: data.url, fields: data.fields }, blob)
      if (target === "icon") {
        await postApiV1MediaCommunityIconConfirm({
          body: { communityId, key: data.key },
          throwOnError: true,
        })
      } else {
        await postApiV1MediaCommunityBannerConfirm({
          body: { communityId, key: data.key },
          throwOnError: true,
        })
      }
      onUpdated()
      toast.success(target === "icon" ? "Icon updated" : "Banner updated")
      setTarget(null)
      setPendingFile(null)
    } catch {
      toast.error("Could not upload image")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit appearance</DialogTitle>
          <DialogDescription>Update the icon and banner for r/{communityName}.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Banner</Label>
            <div className="relative h-24 w-full overflow-hidden rounded-md border bg-gradient-to-r from-primary/30 to-primary/10">
              {bannerImageKey ? (
                // oxlint-disable-next-line no-img-element
                <img
                  src={mediaUrl(bannerImageKey) ?? undefined}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={uploading}
              onClick={() => bannerInputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              Change banner
            </Button>
            <input
              ref={bannerInputRef}
              type="file"
              aria-label="Upload community banner"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                pickFile("banner", e.target.files)
                e.target.value = ""
              }}
            />
          </div>

          <div className="flex items-center gap-4">
            <CommunityIcon
              name={communityName}
              iconUrl={mediaUrl(iconImageKey)}
              size="lg"
              className="border-4 border-background"
            />
            <div className="flex flex-col gap-1">
              <Label>Icon</Label>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={uploading}
                onClick={() => iconInputRef.current?.click()}
              >
                <ImagePlus className="size-4" />
                Change icon
              </Button>
              <input
                ref={iconInputRef}
                type="file"
                aria-label="Upload community icon"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  pickFile("icon", e.target.files)
                  e.target.value = ""
                }}
              />
            </div>
          </div>
        </div>

        <ImageCropDialog
          open={target !== null}
          onOpenChange={(next) => {
            if (!next && !uploading) {
              setTarget(null)
              setPendingFile(null)
            }
          }}
          file={pendingFile}
          aspect={target === "banner" ? 6 : 1}
          circular={target === "icon"}
          title={target === "banner" ? "Crop banner" : "Crop icon"}
          description={
            target === "banner" ? "Drag to frame the banner (6:1)." : "Drag to frame the icon."
          }
          busy={uploading}
          onComplete={(blob) => {
            void uploadCropped(blob)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
