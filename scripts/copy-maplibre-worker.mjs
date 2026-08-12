// Publishes MapLibre's tile-parsing worker to `public/maplibre/`.
//
// MapLibre resolves its worker at runtime with
// `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. That specifier is
// built from a variable, so no bundler can see it: Turbopack rewrites the
// maplibre chunk to `/_next/static/chunks/…` and the worker is then looked for
// beside *that* file, where nothing exists. Next answers with its HTML 404
// page, the browser refuses it for a module script ("non-JavaScript MIME type
// of text/html"), and the worker never starts. The map still draws its canvas
// and its markers — those are main-thread — but vector tiles are decoded in the
// worker, so the basemap stays permanently blank.
//
// Serving the worker from a fixed path we control and pointing MapLibre at it
// with `setWorkerUrl` (see src/features/trips/components/detail/trip-map.tsx)
// sidesteps bundler resolution entirely.
//
// Runs from `predev` and `prebuild`, so the copy can never be a stale version:
// the two files are minified halves of one build and their symbol names only
// line up within a single release.

import { createRequire } from "node:module"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

// The worker imports `./maplibre-gl-shared.mjs`, so the pair has to land in the
// same directory to keep that relative specifier resolvable.
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]

const require = createRequire(import.meta.url)
const distDir = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"))
const outDir = join(process.cwd(), "public", "maplibre")

// Cleared rather than overwritten so a file that disappears from a future
// release doesn't linger and get served alongside the new ones.
await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

for (const file of FILES) {
  const source = await readFile(join(distDir, file), "utf8")
  // The .map files aren't copied — they're far larger than the code and only
  // useful when debugging MapLibre itself. Dropping the trailing reference
  // keeps devtools from requesting a URL that will 404.
  const stripped = source.replace(/\n?\/\/# sourceMappingURL=.*$/, "")
  await writeFile(join(outDir, file), stripped)
}

console.log(`maplibre: copied ${FILES.length} worker files to public/maplibre/`)
