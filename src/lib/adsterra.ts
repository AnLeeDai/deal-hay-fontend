import {
  ADSTERRA_NATIVE_BANNER_CONTAINER_ID,
  ADSTERRA_NATIVE_BANNER_SCRIPT_URL,
  ADSTERRA_POPUNDER_SCRIPT_URL,
  ADSTERRA_SOCIAL_BAR_SCRIPT_URL,
} from "@/config/advertising"

export function initializeAdsterra(nativeContainer: HTMLDivElement): void {
  const document = nativeContainer.ownerDocument
  if (
    !nativeContainer.isConnected ||
    nativeContainer.id !== ADSTERRA_NATIVE_BANNER_CONTAINER_ID
  ) {
    return
  }

  function appendScript(
    id: string,
    src: string,
    parent: HTMLElement,
    async: boolean,
    before: HTMLElement | null = null
  ) {
    // Keep the provider's document-wide listeners and the native placement
    // singletons, including React Strict Mode's repeated effect setup.
    if (document.getElementById(id)) return
    const script = document.createElement("script")
    script.id = id
    script.src = src
    script.async = async
    script.setAttribute("data-cfasync", "false")
    parent.insertBefore(script, before)
  }

  appendScript(
    "adsterra-popunder",
    ADSTERRA_POPUNDER_SCRIPT_URL,
    document.head,
    false
  )
  appendScript(
    "adsterra-native-banner",
    ADSTERRA_NATIVE_BANNER_SCRIPT_URL,
    nativeContainer.parentElement!,
    true,
    nativeContainer
  )
  appendScript(
    "adsterra-social-bar",
    ADSTERRA_SOCIAL_BAR_SCRIPT_URL,
    document.body,
    false
  )
  // Removing script elements cannot undo third-party listeners or timers.
  // The separate application root layout tears down this entire document.
}
