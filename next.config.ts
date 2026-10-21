import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    globalNotFound: true,
    serverActions: { bodySizeLimit: "4mb" },
    proxyClientMaxBodySize: "4mb",
  },
}

export default nextConfig
