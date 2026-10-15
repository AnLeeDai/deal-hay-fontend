"use client"

import { Volume2Icon, VolumeXIcon } from "lucide-react"

import { useRealtime } from "@/components/realtime-provider"
import { Button } from "@/components/ui/button"

export function NotificationSoundToggle() {
  const { notificationSoundEnabled, toggleNotificationSound } = useRealtime()
  const label = notificationSoundEnabled
    ? "Tắt âm thanh tin nhắn và thông báo"
    : "Bật âm thanh tin nhắn và thông báo"

  return (
    <Button
      aria-label={label}
      aria-pressed={notificationSoundEnabled}
      onClick={toggleNotificationSound}
      size="icon"
      title={label}
      variant="ghost"
    >
      {notificationSoundEnabled ? <Volume2Icon /> : <VolumeXIcon />}
    </Button>
  )
}
