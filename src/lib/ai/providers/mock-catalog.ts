import type { Interest, TimeSlot } from "@/lib/trips/trip-domain"

/**
 * Content the mock provider composes itineraries from.
 *
 * Split from the provider logic so the two can change independently: this is
 * data a designer or copywriter could edit, the provider is the algorithm
 * that arranges it. A real model provider will import none of this.
 */

export interface DestinationProfile {
  /** Canonical display name, used in generated copy. */
  city: string
  country: string
  lat: number
  lng: number
  neighbourhoods: string[]
  landmarks: string[]
  cuisines: string[]
  hotelNames: string[]
  /** Rough daily cost per traveller in the destination's own currency. */
  dailyCostIndex: number
  /** Typical high/low in Celsius, used as the centre of the weather model. */
  climate: { high: number; low: number; wetChance: number }
}

/**
 * A curated set rather than a geocoding API: the mock only needs enough real
 * places that generated trips read as plausible. Anything not listed falls
 * back to `genericProfile`, which is honest about being approximate.
 */
const PROFILES: DestinationProfile[] = [
  {
    city: "Tokyo",
    country: "Japan",
    lat: 35.6762,
    lng: 139.6503,
    neighbourhoods: ["Shibuya", "Shinjuku", "Asakusa", "Ginza", "Nakameguro"],
    landmarks: [
      "Senso-ji Temple",
      "Tokyo Tower",
      "Meiji Jingu",
      "teamLab Planets",
      "Tsukiji Outer Market",
    ],
    cuisines: ["Sushi", "Ramen", "Yakitori", "Tempura", "Izakaya"],
    hotelNames: ["Hotel Ryumeikan", "Park Hotel Tokyo", "Nohga Hotel Ueno"],
    dailyCostIndex: 130,
    climate: { high: 21, low: 13, wetChance: 30 },
  },
  {
    city: "Kyoto",
    country: "Japan",
    lat: 35.0116,
    lng: 135.7681,
    neighbourhoods: ["Gion", "Arashiyama", "Higashiyama", "Pontocho"],
    landmarks: [
      "Fushimi Inari Shrine",
      "Kinkaku-ji",
      "Arashiyama Bamboo Grove",
      "Nishiki Market",
    ],
    cuisines: ["Kaiseki", "Soba", "Obanzai", "Matcha desserts"],
    hotelNames: ["Hotel Kanra", "Node Hotel", "Rakuyado Ryokan"],
    dailyCostIndex: 120,
    climate: { high: 22, low: 12, wetChance: 32 },
  },
  {
    city: "Paris",
    country: "France",
    lat: 48.8566,
    lng: 2.3522,
    neighbourhoods: ["Le Marais", "Saint-Germain", "Montmartre", "Canal Saint-Martin"],
    landmarks: [
      "Musée d'Orsay",
      "Sainte-Chapelle",
      "Jardin du Luxembourg",
      "Père Lachaise",
    ],
    cuisines: ["Bistro", "Patisserie", "Brasserie", "Wine bar"],
    hotelNames: ["Hôtel Fabric", "Le Pigalle", "Hôtel des Grands Boulevards"],
    dailyCostIndex: 150,
    climate: { high: 18, low: 10, wetChance: 38 },
  },
  {
    city: "Seoul",
    country: "South Korea",
    lat: 37.5665,
    lng: 126.978,
    neighbourhoods: ["Jongno", "Hongdae", "Seongsu", "Itaewon"],
    landmarks: [
      "Gyeongbokgung Palace",
      "Bukchon Hanok Village",
      "N Seoul Tower",
      "Gwangjang Market",
    ],
    cuisines: ["Korean BBQ", "Bunsik", "Temple cuisine", "Fried chicken"],
    hotelNames: ["L7 Hongdae", "Hotel Cappuccino", "Nine Tree Premier"],
    dailyCostIndex: 110,
    climate: { high: 20, low: 11, wetChance: 28 },
  },
  {
    city: "New York",
    country: "United States",
    lat: 40.7128,
    lng: -74.006,
    neighbourhoods: ["West Village", "Williamsburg", "Harlem", "Lower East Side"],
    landmarks: [
      "The Met",
      "High Line",
      "Brooklyn Bridge",
      "Grand Central Terminal",
    ],
    cuisines: ["Delis", "Pizza", "Steakhouse", "Dim sum"],
    hotelNames: ["The Hoxton", "Ace Hotel", "citizenM Bowery"],
    dailyCostIndex: 190,
    climate: { high: 19, low: 11, wetChance: 34 },
  },
  {
    city: "Bali",
    country: "Indonesia",
    lat: -8.4095,
    lng: 115.1889,
    neighbourhoods: ["Ubud", "Canggu", "Seminyak", "Uluwatu"],
    landmarks: [
      "Ulun Danu Beratan",
      "Tegallalang Rice Terraces",
      "Tirta Empul",
      "Uluwatu Temple",
    ],
    cuisines: ["Warung", "Balinese", "Seafood grill", "Health cafés"],
    hotelNames: ["Bisma Eight", "Katamama", "Suarga Padang Padang"],
    dailyCostIndex: 70,
    climate: { high: 31, low: 24, wetChance: 45 },
  },
  {
    city: "London",
    country: "United Kingdom",
    lat: 51.5072,
    lng: -0.1276,
    neighbourhoods: ["Shoreditch", "South Bank", "Notting Hill", "Soho"],
    landmarks: ["Tate Modern", "Borough Market", "Hampstead Heath", "V&A"],
    cuisines: ["Gastropub", "Indian", "Modern British", "Afternoon tea"],
    hotelNames: ["The Hoxton Shoreditch", "Sea Containers", "The Zetter"],
    dailyCostIndex: 165,
    climate: { high: 16, low: 9, wetChance: 42 },
  },
  {
    city: "Rome",
    country: "Italy",
    lat: 41.9028,
    lng: 12.4964,
    neighbourhoods: ["Trastevere", "Monti", "Testaccio", "Prati"],
    landmarks: ["Pantheon", "Galleria Borghese", "Appian Way", "Trastevere lanes"],
    cuisines: ["Trattoria", "Pizza al taglio", "Enoteca", "Gelateria"],
    hotelNames: ["Hotel Locarno", "G-Rough", "Casa Monti"],
    dailyCostIndex: 135,
    climate: { high: 23, low: 13, wetChance: 26 },
  },
  {
    city: "Lisbon",
    country: "Portugal",
    lat: 38.7223,
    lng: -9.1393,
    neighbourhoods: ["Alfama", "Príncipe Real", "Belém", "Cais do Sodré"],
    landmarks: ["Jerónimos Monastery", "Miradouro da Graça", "LX Factory", "Tram 28"],
    cuisines: ["Tasca", "Seafood", "Pastelaria", "Petiscos"],
    hotelNames: ["Memmo Alfama", "The Ivens", "Casa Amora"],
    dailyCostIndex: 105,
    climate: { high: 22, low: 14, wetChance: 24 },
  },
  {
    city: "Bangkok",
    country: "Thailand",
    lat: 13.7563,
    lng: 100.5018,
    neighbourhoods: ["Riverside", "Thonglor", "Ari", "Old Town"],
    landmarks: ["Wat Pho", "Jim Thompson House", "Chatuchak Market", "Wat Arun"],
    cuisines: ["Street food", "Southern Thai", "Boat noodles", "Rooftop dining"],
    hotelNames: ["The Siam", "Josh Hotel", "Riva Surya"],
    dailyCostIndex: 75,
    climate: { high: 33, low: 26, wetChance: 40 },
  },
]

const genericProfile: DestinationProfile = {
  city: "",
  country: "",
  lat: 41.9028,
  lng: 12.4964,
  neighbourhoods: ["the old town", "the riverside", "the market quarter", "the arts district"],
  landmarks: [
    "the central cathedral",
    "the city museum",
    "the harbour promenade",
    "the botanical gardens",
  ],
  cuisines: ["Local", "Seafood", "Café", "Modern European"],
  hotelNames: ["The Grand", "Central Boutique Hotel", "Old Town Rooms"],
  dailyCostIndex: 120,
  climate: { high: 22, low: 13, wetChance: 30 },
}

/**
 * Matches on substring in both directions so "tokyo, japan" and "Tokyo" both
 * resolve, and returns a flag rather than throwing so the provider can warn
 * the user that coordinates are approximate.
 */
export function resolveDestination(input: string): {
  profile: DestinationProfile
  isApproximate: boolean
} {
  const needle = input.trim().toLowerCase()
  const match = PROFILES.find(
    (p) =>
      needle.includes(p.city.toLowerCase()) ||
      p.city.toLowerCase().includes(needle)
  )
  if (match) return { profile: match, isApproximate: false }
  return {
    profile: { ...genericProfile, city: input.trim() || "your destination" },
    isApproximate: true,
  }
}

export interface ActivityTemplate {
  title: (place: string) => string
  category: string
  description: string
  /**
   * Which parts of the day this template makes sense in. Omitted means "any".
   *
   * Without this a sunset rooftop gets scheduled at 09:30 with the
   * description "worth timing for the last hour of light", which reads as
   * obviously machine-generated — the exact impression the mock exists to
   * avoid.
   */
  slots?: TimeSlot[]
}

/** Activity archetypes, chosen by the traveller's declared interests. */
export const ACTIVITY_TEMPLATES: Record<Interest, ActivityTemplate[]> = {
  food: [
    {
      title: (p) => `Market breakfast at ${p}`,
      category: "food",
      description: "Graze the stalls before the queues build, then take coffee standing up like a local.",
      slots: ["morning"],
    },
    {
      title: (p) => `Food walk through ${p}`,
      category: "food",
      description: "Six or seven small stops rather than one big meal — the best way to read a neighbourhood.",
    },
  ],
  history: [
    {
      title: (p) => `Morning at ${p}`,
      category: "history",
      description: "Arrive at opening to have the older halls largely to yourself.",
      slots: ["morning"],
    },
    {
      title: (p) => `Guided history walk from ${p}`,
      category: "history",
      description: "Two hours on foot covering the layers most visitors walk straight past.",
    },
  ],
  art: [
    {
      title: (p) => `${p} collection`,
      category: "art",
      description: "Skip the blockbuster wing and start at the back — the crowd moves the other way.",
    },
    {
      title: (p) => `Gallery hop around ${p}`,
      category: "art",
      description: "Small independent spaces, most free to enter, most happy to talk.",
    },
  ],
  nature: [
    {
      title: (p) => `Sunrise walk at ${p}`,
      category: "nature",
      description: "Cool air, low light, and almost nobody else out yet.",
      slots: ["morning"],
    },
    {
      title: (p) => `Afternoon in the gardens near ${p}`,
      category: "nature",
      description: "A deliberate gap in the day — somewhere to sit rather than something to see.",
      slots: ["afternoon"],
    },
  ],
  nightlife: [
    {
      title: (p) => `Evening in ${p}`,
      category: "nightlife",
      description: "Start with a drink somewhere small, follow whatever sounds good from the street.",
      slots: ["evening"],
    },
    {
      title: (p) => `Live music near ${p}`,
      category: "nightlife",
      description: "Doors are usually later than you think; eat first.",
      slots: ["evening"],
    },
  ],
  shopping: [
    {
      title: (p) => `Independent shops in ${p}`,
      category: "shopping",
      description: "Makers and small labels rather than the high-street names you have at home.",
    },
    {
      title: (p) => `Flea market at ${p}`,
      category: "shopping",
      description: "Cash helps. So does going early.",
      slots: ["morning"],
    },
  ],
  adventure: [
    {
      title: (p) => `Day trip beyond ${p}`,
      category: "adventure",
      description: "An early start out of the city and back before dinner.",
      slots: ["morning"],
    },
    {
      title: (p) => `Cycle route from ${p}`,
      category: "adventure",
      description: "Mostly flat, mostly car-free, with somewhere good to stop halfway.",
    },
  ],
  architecture: [
    {
      title: (p) => `Architecture walk: ${p}`,
      category: "architecture",
      description: "A route built around six buildings worth stopping in front of.",
    },
    {
      title: (p) => `Rooftop view over ${p}`,
      category: "architecture",
      description: "Worth timing for the last hour of light.",
      slots: ["evening"],
    },
  ],
  beaches: [
    {
      title: (p) => `Beach morning near ${p}`,
      category: "beaches",
      description: "Go before eleven — the light is better and the sand is still cool.",
      slots: ["morning"],
    },
    {
      title: (p) => `Sunset swim at ${p}`,
      category: "beaches",
      description: "Bring something warm for afterwards; the temperature drops fast.",
      slots: ["evening"],
    },
  ],
  wellness: [
    {
      title: (p) => `Bathhouse near ${p}`,
      category: "wellness",
      description: "An hour of doing nothing, which is harder to schedule than it sounds.",
    },
    {
      title: (p) => `Morning yoga in ${p}`,
      category: "wellness",
      description: "Drop-in classes, no booking, mats provided.",
      slots: ["morning"],
    },
  ],
}

/** Used when a traveller picks no interests at all. */
export const DEFAULT_INTERESTS: Interest[] = ["food", "history", "nature"]

/** Split by wet/dry so the weather model picks from the right set directly. */
export const DRY_CONDITIONS = ["Clear", "Mostly sunny", "Partly cloudy"] as const
export const WET_CONDITIONS = ["Overcast", "Light rain", "Showers"] as const

export const PACKING_TEMPLATE: { category: string; items: string[] }[] = [
  {
    category: "Essentials",
    items: ["Passport", "Travel insurance details", "Payment cards", "Phone charger"],
  },
  {
    category: "Clothing",
    items: ["Comfortable walking shoes", "Layers for evenings", "Sleepwear", "Socks and underwear"],
  },
  {
    category: "Health",
    items: ["Any prescriptions", "Basic first aid", "Sunscreen", "Reusable water bottle"],
  },
  {
    category: "Tech",
    items: ["Power adapter", "Headphones", "Portable battery"],
  },
]

export const WET_WEATHER_ITEMS = ["Compact umbrella", "Waterproof jacket"]
export const HOT_WEATHER_ITEMS = ["Sun hat", "Light breathable layers"]
export const COLD_WEATHER_ITEMS = ["Warm coat", "Gloves and scarf"]
