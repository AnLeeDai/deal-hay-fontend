"use client"

import { useEffect, useId, useRef, useState } from "react"

import { startInventoryCamera } from "@/modules/shop-management/lib/inventory-camera"

export function InventoryQrScanner({
  onScan,
  onError,
}: {
  onScan: (code: string) => void
  onError: (message: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const instructionsId = useId()
  const [ready, setReady] = useState(false)
  const callbacks = useRef({ onScan, onError })
  useEffect(() => {
    callbacks.current = { onScan, onError }
  }, [onScan, onError])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const scanner = startInventoryCamera(video, {
      onScan: (sku) => callbacks.current.onScan(sku),
      onError: (message) => callbacks.current.onError(message),
      onReady: () => setReady(true),
    })
    return () => {
      void scanner.stop()
    }
  }, [])

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Camera quét QR trên tem hàng hóa"
        aria-describedby={instructionsId}
        className="max-h-72 w-full rounded-lg bg-black"
      />
      <p role="status" className="text-xs text-muted-foreground">
        {ready
          ? "Camera sẵn sàng. Đưa tem QR vào khung hình."
          : "Đang mở camera..."}
      </p>
      <p id={instructionsId} className="text-xs text-muted-foreground">
        Camera đọc SKU trên tem và dừng sau mỗi lượt. Bấm Quét bằng camera để
        quét tiếp.
      </p>
    </div>
  )
}
