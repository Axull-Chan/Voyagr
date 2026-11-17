import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/**
 * Unit tests for the app's pure logic — date and money maths, validation
 * schemas, the export shape, and the AI layer's "never trust the model for a
 * fact" resolution step. Nothing here touches the network or the database, so
 * the suite needs no environment variables and runs in a couple of seconds.
 *
 * The `@` alias mirrors `paths` in tsconfig.json; Vitest doesn't read it.
 */
export default defineConfig({
  // tsconfig sets `jsx: "preserve"` (Next compiles JSX itself), which leaves
  // Vitest unable to parse the PDF document tests. Vite 8 transforms with Oxc.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
