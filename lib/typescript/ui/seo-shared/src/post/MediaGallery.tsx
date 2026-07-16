"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, EyeOff } from "lucide-react"
import { cn } from "@ui/base/lib/utils"
import { Dialog, DialogContent } from "@ui/base/ui/dialog"

export type MediaGalleryItem = {
  mediaType: string
  url: string
  width: number | null
  height: number | null
}

export type MediaGalleryProps = {
  media: MediaGalleryItem[]
  isNsfw?: boolean
  isSpoiler?: boolean
  className?: string
}

function isVideo(item: MediaGalleryItem): boolean {
  return item.mediaType === "video"
}

function MediaItem({
  item,
  onOpenLightbox,
}: {
  item: MediaGalleryItem
  onOpenLightbox?: () => void
}) {
  if (isVideo(item)) {
    return (
      // oxlint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded video without captions
      <video
        src={item.url}
        controls
        preload="metadata"
        aria-label="Post video"
        className="max-h-[512px] w-full bg-black object-contain"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={onOpenLightbox}
      className="flex w-full cursor-zoom-in justify-center"
      aria-label="Open image"
    >
      {/* oxlint-disable-next-line no-img-element */}
      <img src={item.url} alt="" loading="lazy" className="max-h-[512px] w-full object-contain" />
    </button>
  )
}

/**
 * Renders a post's media array. Single image: constrained, click to open a
 * full-size lightbox. Multiple items: a carousel with arrows, dots and a
 * counter chip. Video: native controls. NSFW/spoiler posts render blurred
 * behind a "View" reveal. Presentational and props-only (shared SSR + SPA).
 */
export function MediaGallery({ media, isNsfw, isSpoiler, className }: MediaGalleryProps) {
  const [index, setIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)

  if (media.length === 0) return null

  const nsfw = isNsfw ?? false
  const spoiler = isSpoiler ?? false
  const blurred = (nsfw || spoiler) && !revealed
  const count = media.length
  const clampedIndex = Math.min(index, count - 1)
  const current = media[clampedIndex]
  if (!current) return null

  const go = (delta: number) => {
    setIndex((i) => {
      const next = (i + delta + count) % count
      return next
    })
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-neutral-950", className)}>
      <div className={cn("relative", blurred && "pointer-events-none")}>
        <div className={cn(blurred && "scale-105 blur-2xl")}>
          {count === 1 ? (
            <MediaItem
              item={current}
              onOpenLightbox={() => {
                setLightboxOpen(true)
              }}
            />
          ) : (
            <MediaItem
              key={clampedIndex}
              item={current}
              onOpenLightbox={
                isVideo(current)
                  ? undefined
                  : () => {
                      setLightboxOpen(true)
                    }
              }
            />
          )}
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => {
                go(-1)
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => {
                go(1)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              {clampedIndex + 1}/{count}
            </div>
            <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
              {media.map((m, i) => (
                <button
                  key={m.url}
                  type="button"
                  aria-label={`Go to item ${i + 1}`}
                  onClick={() => {
                    setIndex(i)
                  }}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    i === clampedIndex ? "bg-white" : "bg-white/50 hover:bg-white/75",
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {blurred ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              setRevealed(true)
            }}
            className="inline-flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-background"
          >
            <EyeOff className="size-4" />
            {nsfw ? "View NSFW" : "View spoiler"}
          </button>
        </div>
      ) : null}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] border-0 bg-transparent p-0 shadow-none sm:max-w-[90vw]">
          {isVideo(current) ? (
            // oxlint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded video without captions
            <video
              src={current.url}
              controls
              autoPlay
              aria-label="Post video"
              className="max-h-[90vh] w-full rounded-md bg-black object-contain"
            />
          ) : (
            // oxlint-disable-next-line no-img-element
            <img
              src={current.url}
              alt=""
              className="max-h-[90vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
