const authReturnPrefixes = [
  "/sell",
  "/profile",
  "/discount-codes",
  "/diagnostics",
  "/shops",
  "/notifications",
  "/chats",
  "/shop-manage",
  "/admin",
]
const redirectOrigin = "https://deal-hay.local"

export function getSafeAuthRedirect(value?: string | string[] | null): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/"

  try {
    const decoded = decodeURIComponent(value)
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      Array.from(decoded).some((character) => {
        const code = character.charCodeAt(0)
        return code < 32 || code === 127
      })
    ) {
      return "/"
    }

    const destination = new URL(value, redirectOrigin)
    if (
      destination.origin !== redirectOrigin ||
      (destination.pathname !== "/" &&
        !authReturnPrefixes.some(
          (prefix) =>
            destination.pathname === prefix ||
            destination.pathname.startsWith(`${prefix}/`)
        ))
    ) {
      return "/"
    }

    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return "/"
  }
}

export function getAuthPageHref(
  path: "/sign-in" | "/sign-up",
  redirectTo?: string
): string {
  const destination = getSafeAuthRedirect(redirectTo)
  return destination === "/"
    ? path
    : `${path}?redirect=${encodeURIComponent(destination)}`
}
