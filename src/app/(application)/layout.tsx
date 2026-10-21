import { SiteDocument, siteMetadata } from "@/components/layout/site-document"

export const metadata = siteMetadata

export default function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SiteDocument>{children}</SiteDocument>
}
