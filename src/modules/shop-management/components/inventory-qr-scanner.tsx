"use client"

import { useEffect, useRef } from "react"

export function InventoryQrScanner({
  onScan,
  onError,
}: {
  onScan: (code: string) => void
  onError: (message: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const callbacks = useRef({ onScan, onError })
  useEffect(() => {
    callbacks.current = { onScan, onError }
  }, [onScan, onError])

  useEffect(() => {
    let cancelled = false
    let detected = false
    let controls: { stop: () => void } | undefined
    const video = videoRef.current
    async function start() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser")
        if (cancelled || !video) return
        const reader = new BrowserQRCodeReader()
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          video,
          (result, _error, scanner) => {
            if (!cancelled && !detected && result) {
              detected = true
              scanner.stop()
              callbacks.current.onScan(result.getText())
            }
          }
        )
        if (cancelled || detected) controls.stop()
      } catch {
        if (!cancelled)
          callbacks.current.onError(
            "Không mở được camera. Hãy cấp quyền camera trên kết nối HTTPS, hoặc dùng máy quét / nhập mã bên dưới."
          )
      }
    }
    void start()
    return () => {
      cancelled = true
      controls?.stop()
      const stream = video?.srcObject
      if (stream instanceof MediaStream)
        stream.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="max-h-72 w-full rounded-lg bg-black"
      />
      <p className="text-xs text-muted-foreground">
        Đưa một tem QR vào khung hình. Camera dừng sau mỗi lượt để tránh đếm
        trùng; bấm Quét bằng camera để quét tiếp.
      </p>
    </div>
  )
}
