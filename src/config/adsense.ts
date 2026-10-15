export const ADSENSE_CLIENT_ID = "ca-pub-7303400269186048"

export const ADSENSE_SCRIPT_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`

export function isAdSenseStorefrontPath(pathname: string | null): boolean {
  if (!pathname) return false

  return (
    pathname === "/" ||
    /^\/shops\/[^/]+\/?$/.test(pathname) ||
    /^\/shops\/[^/]+\/products\/[^/]+\/?$/.test(pathname)
  )
}
