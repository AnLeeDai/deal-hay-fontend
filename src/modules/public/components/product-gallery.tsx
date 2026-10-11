"use client"

import { useMemo, useState } from "react"

import { MediaImage } from "@/components/media-image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type ProductGalleryProps = {
  name: string
  imageUrl: string | null
  images: Array<{ id: string; image_url: string }>
}

export function ProductGallery({
  name,
  imageUrl,
  images,
}: ProductGalleryProps) {
  const gallery = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...(imageUrl ? [{ id: "primary", image_url: imageUrl }] : []),
            ...images,
          ].map((image) => [image.image_url, image])
        ).values()
      ),
    [imageUrl, images]
  )
  const [selectedUrl, setSelectedUrl] = useState<string | null>(
    gallery[0]?.image_url ?? null
  )
  const activeUrl = gallery.some((image) => image.image_url === selectedUrl)
    ? selectedUrl
    : (gallery[0]?.image_url ?? null)

  return (
    <div className="space-y-3">
      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <MediaImage
            alt={name}
            className="aspect-square w-full"
            fallbackLabel="Sản phẩm chưa có ảnh"
            loading="eager"
            sizes="(max-width: 1024px) 100vw, 55vw"
            src={activeUrl}
          />
        </CardContent>
      </Card>
      {gallery.length > 1 ? (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
          {gallery.map((image, index) => (
            <Button
              key={image.id}
              aria-label={`Xem ảnh ${index + 1} của ${name}`}
              aria-pressed={activeUrl === image.image_url}
              className="h-auto overflow-hidden p-0"
              variant={activeUrl === image.image_url ? "default" : "outline"}
              onClick={() => setSelectedUrl(image.image_url)}
            >
              <MediaImage
                alt=""
                className="aspect-square w-full"
                fallbackLabel="Ảnh lỗi"
                sizes="120px"
                src={image.image_url}
              />
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
