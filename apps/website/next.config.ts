import * as path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Links routinely point at SPA routes served through the proxy (e.g. /dashboard),
  // which typed routes would reject as unknown Next.js routes
  typedRoutes: false,
  // TypeScript 7 has no JS compiler API yet; run type checking through the tsc CLI
  experimental: {
    useTypeScriptCli: true,
  },
  transpilePackages: ["@template-nextjs/db", "@ui/base", "@ui/seo-shared", "@lib/api-client"],
  turbopack: {
    root: path.join(__dirname, "..", ".."),
    resolveAlias: {
      // Swap the seo-shared link template for the next/link adapter
      "@ui/seo-shared/_internal/seo-link": "./src/components/seo-link.tsx",
    },
  },
}

export default nextConfig
