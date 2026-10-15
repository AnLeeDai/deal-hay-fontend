export const ADSTERRA_SMARTLINK_URL =
  "https://www.profitableratecpmnetwork.com/kyeauguj?key=0c9c015392eee094b68685f873d92dac"

export const ADSTERRA_WEBSITE_SCRIPTS = [
  "https://pl31851231.profitableratecpmnetwork.com/d1/ef/34/d1ef34f7547431dda803fb4f5849055c.js",
  "https://pl31851232.profitableratecpmnetwork.com/6d/2d/55/6d2d5564c18455acfe7ff77b2d908f42.js",
] as const

export function isStorefrontAdvertisingPath(pathname: string | null): boolean {
  if (!pathname) return false

  return (
    pathname === "/" ||
    /^\/shops\/[^/]+\/?$/.test(pathname) ||
    /^\/shops\/[^/]+\/products\/[^/]+\/?$/.test(pathname)
  )
}
