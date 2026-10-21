import { GOOGLE_PUBLISHER_TAG_SCRIPT_URL } from "@/config/advertising"

type RewardedSlot = { addService: (service: PublisherAdsService) => void }
type SlotEvent = { slot: RewardedSlot }
type EventMap = {
  rewardedSlotReady: SlotEvent & { makeRewardedVisible: () => boolean }
  rewardedSlotGranted: SlotEvent
  rewardedSlotClosed: SlotEvent
  slotRenderEnded: SlotEvent & { isEmpty: boolean }
}
type PublisherAdsService = {
  addEventListener: <K extends keyof EventMap>(
    name: K,
    listener: (event: EventMap[K]) => void
  ) => void
  removeEventListener: <K extends keyof EventMap>(
    name: K,
    listener: (event: EventMap[K]) => void
  ) => void
}
type GooglePublisherTag = {
  cmd: { push: (callback: () => void) => unknown }
  enums: { OutOfPageFormat: { REWARDED: unknown } }
  defineOutOfPageSlot: (path: string, format: unknown) => RewardedSlot | null
  pubads: () => PublisherAdsService
  enableServices: () => void
  display: (slot: RewardedSlot) => void
  destroySlots: (slots: RewardedSlot[]) => void
}

export type RewardedAdController = { destroy: () => void }
type RewardedAdCallbacks = {
  onVisibleChange: (visible: boolean) => void
  onGranted: () => void
  onClosed: (granted: boolean) => void
  onError: (message: string) => void
}

let activeAd: RewardedAdController | null = null

// Call only from an explicit "watch for free shipping" action after consent.
// GPT's grant event is a browser signal, not signed server-side verification.
export function requestGoogleRewardedAd(
  adUnitPath: string,
  callbacks: RewardedAdCallbacks
): RewardedAdController {
  const empty = { destroy() {} }
  if (!/^\/\d+\/[^\s?#]+$/.test(adUnitPath)) {
    callbacks.onError("Quảng cáo có thưởng hiện chưa khả dụng.")
    return empty
  }
  if (activeAd) {
    callbacks.onError("Một quảng cáo khác đang mở. Vui lòng đóng để tiếp tục.")
    return empty
  }

  const scope = window as Window & {
    googletag?: GooglePublisherTag | { cmd: (() => void)[] }
  }
  scope.googletag ??= { cmd: [] }
  let tag: GooglePublisherTag | undefined
  let service: PublisherAdsService | undefined
  let slot: RewardedSlot | null = null
  let script: HTMLScriptElement | null = null
  let disposed = false
  let shown = false
  let closed = false
  let granted = false
  let slotDestroyed = false

  function destroySlot() {
    if (slot && !slotDestroyed) {
      slotDestroyed = true
      tag?.destroySlots([slot])
    }
  }

  function removePlaybackListeners() {
    service?.removeEventListener("rewardedSlotReady", onReady)
    service?.removeEventListener("rewardedSlotClosed", onClosed)
    service?.removeEventListener("slotRenderEnded", onRenderEnded)
  }

  function destroy() {
    if (disposed) return
    disposed = true
    window.clearTimeout(timeout)
    script?.removeEventListener("error", onScriptError)
    removePlaybackListeners()
    service?.removeEventListener("rewardedSlotGranted", onGranted)
    destroySlot()
    if (activeAd === controller) activeAd = null
    if (shown && !closed) callbacks.onVisibleChange(false)
  }

  function fail(message: string) {
    if (disposed) return
    destroy()
    callbacks.onError(message)
  }

  function onScriptError() {
    script?.remove()
    fail(
      "Không tải được quảng cáo. Vui lòng thử lại hoặc kiểm tra trình chặn quảng cáo."
    )
  }

  function onReady(event: EventMap["rewardedSlotReady"]) {
    if (disposed || event.slot !== slot || shown || closed) return
    shown = true
    callbacks.onVisibleChange(true)
    try {
      if (!event.makeRewardedVisible()) {
        fail("Không mở được quảng cáo trên thiết bị này. Vui lòng thử lại sau.")
        return
      }
      window.clearTimeout(timeout)
    } catch {
      fail("Không mở được quảng cáo. Vui lòng thử lại sau.")
    }
  }

  function onGranted(event: EventMap["rewardedSlotGranted"]) {
    if (disposed || event.slot !== slot || !shown || granted) return
    granted = true
    callbacks.onGranted()
  }

  function onClosed(event: EventMap["rewardedSlotClosed"]) {
    if (disposed || event.slot !== slot || closed) return
    closed = true
    window.clearTimeout(timeout)
    removePlaybackListeners()
    destroySlot()
    if (activeAd === controller) activeAd = null
    callbacks.onVisibleChange(false)
    callbacks.onClosed(granted)
    // Keep the grant listener until the caller disposes this attempt. GPT may
    // deliver the grant after close; closing alone must never grant a reward.
  }

  function onRenderEnded(event: EventMap["slotRenderEnded"]) {
    if (!disposed && event.slot === slot && event.isEmpty)
      fail(
        "Hiện chưa có quảng cáo phù hợp. Bạn có thể thử lại sau hoặc tiếp tục đặt hàng."
      )
  }

  const controller = { destroy }
  activeAd = controller
  const timeout = window.setTimeout(
    () =>
      fail(
        "Quảng cáo tải quá lâu. Vui lòng thử lại sau hoặc tiếp tục đặt hàng."
      ),
    20_000
  )

  scope.googletag.cmd.push(() => {
    if (disposed) return
    try {
      tag = scope.googletag as GooglePublisherTag
      slot = tag.defineOutOfPageSlot(
        adUnitPath,
        tag.enums.OutOfPageFormat.REWARDED
      )
      if (!slot) {
        fail("Thiết bị hoặc trình duyệt này chưa hỗ trợ quảng cáo có thưởng.")
        return
      }
      service = tag.pubads()
      slot.addService(service)
      service.addEventListener("rewardedSlotReady", onReady)
      service.addEventListener("rewardedSlotGranted", onGranted)
      service.addEventListener("rewardedSlotClosed", onClosed)
      service.addEventListener("slotRenderEnded", onRenderEnded)
      tag.enableServices()
      tag.display(slot)
    } catch {
      fail("Không chuẩn bị được quảng cáo. Vui lòng thử lại sau.")
    }
  })

  if (!disposed) {
    script = document.getElementById(
      "google-publisher-tag"
    ) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement("script")
      script.id = "google-publisher-tag"
      script.async = true
      script.crossOrigin = "anonymous"
      script.src = GOOGLE_PUBLISHER_TAG_SCRIPT_URL
      script.addEventListener("error", onScriptError)
      document.head.appendChild(script)
    } else {
      script.addEventListener("error", onScriptError)
    }
  }
  return controller
}
