export const ADSENSE_PUBLISHER_ID = "pub-8299349376566920"
export const ADSENSE_CLIENT_ID = `ca-${ADSENSE_PUBLISHER_ID}`
export const ADSENSE_SCRIPT_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`

export function isStorefrontAdvertisingPath(pathname: string | null): boolean {
  if (!pathname) return false

  return (
    pathname === "/" ||
    /^\/shops\/[^/]+\/?$/.test(pathname) ||
    /^\/shops\/[^/]+\/products\/[^/]+\/?$/.test(pathname)
  )
}
