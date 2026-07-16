import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*", "lib/typescript/*"],
    exclude: ["**/node_modules/**", "**/build/**", "**/dist/**"],
  },
})
