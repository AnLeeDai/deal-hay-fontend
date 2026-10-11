"use client"

import Image from "next/image"
import { ImageIcon } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"

type MediaImageProps = {
  src: string | null | undefined
  alt: string
  className?: string
  imageClassName?: string
  fallbackLabel?: string
  loading?: "eager" | "lazy"
  sizes?: string
}

export function MediaImage({
  src,
  alt,
  className,
  imageClassName,
  fallbackLabel = "Chưa có ảnh",
  loading = "lazy",
  sizes = "100vw",
}: MediaImageProps) {
  const normalizedSrc = src?.trim() || null
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const canRenderImage = normalizedSrc !== null && failedSrc !== normalizedSrc

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {canRenderImage ? (
        <Image
          fill
          unoptimized
          alt={alt}
          className={cn("object-cover", imageClassName)}
          loading={loading}
          sizes={sizes}
          src={normalizedSrc}
          onError={() => setFailedSrc(normalizedSrc)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
          <ImageIcon aria-hidden="true" className="size-6" />
          <span className="text-xs">{fallbackLabel}</span>
        </div>
      )}
    </div>
  )
}
