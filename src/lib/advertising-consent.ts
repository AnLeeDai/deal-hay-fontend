export type AdvertisingConsent = "accepted" | "declined"

export const ADVERTISING_CONSENT_COOKIE = "deal-hay-advertising-consent"
export const ADVERTISING_CONSENT_MAX_AGE = 60 * 60 * 24 * 180
export const ADVERTISING_CONSENT_CHANGE_EVENT =
  "deal-hay:advertising-consent-change"

export function parseAdvertisingConsent(
  value: string | undefined
): AdvertisingConsent | null {
  if (value === "v1:accepted") return "accepted"
  if (value === "v1:declined") return "declined"
  return null
}

export function readAdvertisingConsent(
  cookieHeader: string
): AdvertisingConsent | null {
  const prefix = `${ADVERTISING_CONSENT_COOKIE}=`
  const cookie = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
  return parseAdvertisingConsent(cookie?.slice(prefix.length))
}

export function serializeAdvertisingConsent(
  consent: AdvertisingConsent,
  secure: boolean
): string {
  return `${ADVERTISING_CONSENT_COOKIE}=v1:${consent}; Path=/; Max-Age=${ADVERTISING_CONSENT_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`
}
