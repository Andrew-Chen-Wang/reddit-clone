import { useEffect, useRef, useState } from "react"
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"
import { Button } from "@ui/base/ui/button"
import { LoadingButton } from "@ui/base/ui/loading-button"

export type ImageCropDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Source file to crop. */
  file: File | null
  /** Target aspect ratio (width / height). */
  aspect: number
  /** Round crop preview (avatars / icons). */
  circular?: boolean
  title: string
  description?: string
  /** Called with the cropped PNG blob once the user confirms. */
  onComplete: (blob: Blob) => void
  /** Keeps the confirm button in a loading state while the upload runs. */
  busy?: boolean
}

function centeredAspectCrop(width: number, height: number, aspect: number): Crop {
  return centerCrop(makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height), width, height)
}

async function toCroppedBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.floor(crop.width * scaleX))
  canvas.height = Math.max(1, Math.floor(crop.height * scaleY))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not supported")
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Could not render crop"))
    }, "image/png")
  })
}

/**
 * Loads a picked image, lets the user crop it to a fixed aspect (optionally a
 * circular preview) and hands back a cropped PNG blob ready for upload.
 */
export function ImageCropDialog({
  open,
  onOpenChange,
  file,
  aspect,
  circular,
  title,
  description,
  onComplete,
  busy,
}: ImageCropDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop | undefined>(undefined)
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>(undefined)

  useEffect(() => {
    if (!file) {
      setSrc(null)
      return
    }
    const url = URL.createObjectURL(file)
    setSrc(url)
    setCrop(undefined)
    setCompletedCrop(undefined)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  async function confirm() {
    if (!imgRef.current || !completedCrop || completedCrop.width === 0) return
    try {
      const blob = await toCroppedBlob(imgRef.current, completedCrop)
      onComplete(blob)
    } catch {
      // Surfaced by the caller's upload error handling; nothing to do here.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {src ? (
          <div className="flex max-h-[60vh] justify-center overflow-auto">
            <ReactCrop
              crop={crop}
              onChange={(pixelCrop) => {
                setCrop(pixelCrop)
              }}
              onComplete={(pixelCrop) => {
                setCompletedCrop(pixelCrop)
              }}
              aspect={aspect}
              circularCrop={circular}
              keepSelection
            >
              {/* oxlint-disable-next-line no-img-element */}
              <img
                ref={imgRef}
                src={src}
                alt=""
                className="max-h-[55vh] w-auto"
                onLoad={(e) => {
                  const { width, height } = e.currentTarget
                  setCrop(centeredAspectCrop(width, height, aspect))
                }}
              />
            </ReactCrop>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <LoadingButton
            loading={busy}
            disabled={!completedCrop}
            onClick={() => {
              void confirm()
            }}
          >
            Save
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
