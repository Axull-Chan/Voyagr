# Self-hosted fonts

Loaded with `next/font/local` (see `app-fonts.ts` and `film-serif.ts`), so the
build never contacts Google Fonts. All four families are licensed under the
SIL Open Font License 1.1; the licence texts are in `licenses/`.

| File | Family | Source (npm package, version at time of copy) |
| --- | --- | --- |
| `Geist-Variable.woff2` | Geist (variable, wght 100-900) | `geist@1.9.2`, `dist/fonts/geist-sans/Geist-Variable.woff2` |
| `GeistMono-Variable.woff2` | Geist Mono (variable, wght 100-900) | `geist@1.9.2`, `dist/fonts/geist-mono/GeistMono-Variable.woff2` |
| `Fraunces-latin-VF.woff2` | Fraunces (variable: wght, opsz, SOFT, WONK; latin) | `@fontsource-variable/fraunces@5.3.0`, `files/fraunces-latin-full-normal.woff2` |
| `CormorantGaramond-latin-300.woff2`, `-400.woff2` | Cormorant Garamond 300 / 400, normal (latin) | `@fontsource/cormorant-garamond@5.3.0`, `files/cormorant-garamond-latin-{300,400}-normal.woff2` |

To refresh: install the package with `--no-save` in a scratch directory (never
inside the project), copy the file out, update this table.

## Open Graph card fonts (`og/`)

`og/Fraunces-latin-400.woff` and `og/Fraunces-latin-600.woff` are static
Fraunces cuts from `@fontsource/fraunces@5.3.0` (`files/fraunces-latin-{400,600}-normal.woff`,
SIL OFL 1.1, same licence text as above). They are used only by
`src/lib/og/brand-image.tsx`: the share image renderer (Satori) reads
TTF/OTF/WOFF but not WOFF2, so it cannot use the variable woff2 above.
