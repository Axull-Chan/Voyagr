/**
 * A tiny in-process TTL cache with request coalescing.
 *
 * Deliberately not Redis: every consumer here is a Server Component or server
 * action running in one Node process, and the data is cheap to refetch. What
 * it does need to prevent is the two failure modes that actually bite —
 * refetching the same forecast for every render, and firing N identical
 * requests when N renders miss simultaneously (the "thundering herd").
 * `getOrSet` solves the second by caching the *promise*, so concurrent callers
 * for the same key await one in-flight request.
 *
 * Swapping this for a shared cache later means reimplementing this one file:
 * nothing outside it knows how entries are stored.
 */

interface Entry<T> {
  /** The in-flight or settled request. Storing the promise is what coalesces. */
  promise: Promise<T>
  /** Epoch ms after which this entry is stale. */
  expiresAt: number
}

export interface CacheOptions {
  /** How long a successful result stays fresh. */
  ttlMs: number
  /** Cap on entries; oldest-inserted are dropped first. */
  maxEntries?: number
}

const DEFAULT_MAX_ENTRIES = 500

export class TtlCache {
  private readonly store = new Map<string, Entry<unknown>>()
  private readonly maxEntries: number

  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries
  }

  /**
   * Returns the cached value for `key`, or runs `factory` and caches it.
   *
   * A rejected promise is evicted rather than cached, so one network blip
   * doesn't poison the key for the whole TTL.
   */
  async getOrSet<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>
  ): Promise<T> {
    const existing = this.store.get(key)
    if (existing && existing.expiresAt > Date.now()) {
      return existing.promise as Promise<T>
    }

    const promise = factory()
    this.store.set(key, { promise, expiresAt: Date.now() + ttlMs })
    this.evictIfNeeded()

    try {
      return await promise
    } catch (error) {
      // Only drop it if this exact entry is still the one stored — a newer
      // attempt may already have replaced it.
      if (this.store.get(key)?.promise === promise) this.store.delete(key)
      throw error
    }
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }

  /** Map preserves insertion order, so the first key is the oldest. */
  private evictIfNeeded(): void {
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next()
      if (oldest.done) break
      this.store.delete(oldest.value)
    }
  }
}

/**
 * How long each kind of data stays fresh.
 *
 * Chosen from how fast the underlying data actually changes, not from a guess:
 * Frankfurter publishes once per working day from ECB reference rates, so an
 * hour is already conservative; Open-Meteo regenerates its forecast hourly;
 * places and images for a destination are effectively static over a session.
 */
export const CACHE_TTL = {
  /** Forecasts are recomputed hourly upstream. */
  weather: 60 * 60 * 1000,
  /** Published once per working day; an hour keeps us current without churn. */
  currency: 60 * 60 * 1000,
  /** A city's museums don't move. */
  places: 24 * 60 * 60 * 1000,
  /** Geocoding a city name is stable; short TTL keeps us inside Mapbox's
   *  temporary-use terms rather than persisting the result. */
  geocode: 6 * 60 * 60 * 1000,
  /** Hero imagery for a destination rarely needs to change. */
  images: 24 * 60 * 60 * 1000,
} as const

/** One shared instance; keys are namespaced by the integration that owns them. */
export const integrationCache = new TtlCache()
