import {
  findDestinationImage,
  isUnsplashConfigured,
  trackDownload,
  type DestinationImage,
} from "@/integrations/unsplash/images"
import { attempt, live, unavailable, type ServiceResult } from "@/services/service-result"

/**
 * Destination imagery.
 *
 * Returns null rather than a stand-in photo when nothing is found: the hero
 * falls back to a gradient, which looks deliberate, whereas a generic stock
 * beach on a Kyoto trip looks broken.
 */

export type { DestinationImage }

export async function getDestinationImage(
  destination: string
): Promise<ServiceResult<DestinationImage | null>> {
  return attempt("Destination photos", null, async () => {
    if (!isUnsplashConfigured()) {
      return unavailable(null, "Destination photos aren't connected.")
    }
    const image = await findDestinationImage(destination)
    return image
      ? live(image)
      : unavailable(null, `No photo found for ${destination}.`)
  })
}

/**
 * Records that a photo was adopted, as Unsplash's guidelines require.
 *
 * Called once when a trip takes an image — not on every page view, which
 * would misreport usage and waste requests.
 */
export async function recordImageUse(image: DestinationImage): Promise<void> {
  if (!image.downloadLocation) return
  await trackDownload(image.downloadLocation)
}
