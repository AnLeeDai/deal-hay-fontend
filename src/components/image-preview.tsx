"use client"

import { XIcon } from "lucide-react"

import { MediaImage } from "@/components/media-image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export function ImagePreview({
  src,
  alt,
  className,
  thumbnailClassName,
  fallbackLabel = "Không thể tải ảnh",
  sizes = "100vw",
}: {
  src: string
  alt: string
  className?: string
  thumbnailClassName?: string
  fallbackLabel?: string
  sizes?: string
}) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Phóng to ảnh ${alt}`}
        className={cn(
          "block max-w-full cursor-zoom-in rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        <MediaImage
          alt={alt}
          className={thumbnailClassName}
          fallbackLabel={fallbackLabel}
          sizes={sizes}
          src={src}
        />
      </DialogTrigger>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-6xl gap-3 p-3 sm:max-w-6xl"
        showCloseButton={false}
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <DialogTitle className="min-w-0 truncate">{alt}</DialogTitle>
          <DialogClose render={<Button size="icon-sm" variant="ghost" />}>
            <XIcon />
            <span className="sr-only">Đóng ảnh</span>
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">
          Xem ảnh ở kích thước lớn.
        </DialogDescription>
        <MediaImage
          alt={alt}
          className="h-[min(75dvh,calc(100dvh-7rem))] w-full rounded-lg"
          fallbackLabel={fallbackLabel}
          imageClassName="object-contain"
          loading="eager"
          sizes="(max-width: 1200px) 100vw, 1152px"
          src={src}
        />
      </DialogContent>
    </Dialog>
  )
}
