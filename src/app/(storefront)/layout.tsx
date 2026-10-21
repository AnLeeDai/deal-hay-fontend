import { cookies } from "next/headers"

import { SiteDocument, siteMetadata } from "@/components/layout/site-document"
import { StorefrontAdvertising } from "@/components/storefront-advertising"
import {
  ADVERTISING_CONSENT_COOKIE,
  parseAdvertisingConsent,
} from "@/lib/advertising-consent"

export const metadata = siteMetadata

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies()
  const consent = parseAdvertisingConsent(
    cookieStore.get(ADVERTISING_CONSENT_COOKIE)?.value
  )

  // A distinct root layout makes entry into account/admin pages a full
  // document navigation, disposing all third-party listeners and timers.
  return (
    <SiteDocument
      advertising={<StorefrontAdvertising initialConsent={consent} />}
    >
      {children}
    </SiteDocument>
  )
}
