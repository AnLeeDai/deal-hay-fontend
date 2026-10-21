import { GOOGLE_ADSENSE_SCRIPT_URL } from "@/config/advertising"

export function initializeGoogleAdsense(document: Document): void {
  if (
    document.getElementById("google-adsense") ||
    Array.from(document.scripts).some(
      (script) => script.src === GOOGLE_ADSENSE_SCRIPT_URL
    )
  ) {
    return
  }

  const script = document.createElement("script")
  script.id = "google-adsense"
  script.async = true
  script.crossOrigin = "anonymous"
  script.src = GOOGLE_ADSENSE_SCRIPT_URL
  document.head.appendChild(script)
}
