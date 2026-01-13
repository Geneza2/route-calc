import { type NextRequest, NextResponse } from "next/server"

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || ""
const GEOAPIFY_GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"
const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const CYRILLIC_REGEX = /[\u0400-\u04FF]/

type AddressOption = {
  address: string
  coordinates: [number, number]
  street?: string
  housenumber?: string
  city?: string
  postcode?: string
}

const streetCache = new Map<string, { data: AddressOption[]; cachedAt: number }>()

const pickLatinValue = (props: Record<string, any>, key: string) => {
  const latin = props[`${key}:sr-Latn`] ?? props[`${key}:latin`]
  if (typeof latin === "string" && latin.trim()) {
    return latin.trim()
  }
  const fallback = props[key]
  if (typeof fallback === "string" && fallback.trim() && !CYRILLIC_REGEX.test(fallback)) {
    return fallback.trim()
  }
  return undefined
}

const buildStreetList = (features: any[]) => {
  const seen = new Set<string>()
  return features
    .map((feature) => {
      const props = feature?.properties || {}
      const street = pickLatinValue(props, "street") || pickLatinValue(props, "name")
      if (!street || typeof street !== "string") return null

      const housenumber = props.housenumber
      const address = housenumber ? `${street} ${housenumber}` : street
      const lon = Number(props.lon)
      const lat = Number(props.lat)
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
      if (seen.has(address)) return null
      seen.add(address)

      return {
        address,
        coordinates: [lon, lat],
        street,
        housenumber,
        city:
          pickLatinValue(props, "city") ||
          pickLatinValue(props, "town") ||
          pickLatinValue(props, "village"),
        postcode: props.postcode,
      }
    })
    .filter(Boolean) as AddressOption[]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const town = searchParams.get("town")?.trim()

    console.log("[v0] Street preload API called with:", { town })

    if (!town) {
      console.log("[v0] Error: Town parameter missing")
      return NextResponse.json({ error: "Town parameter is required" }, { status: 400 })
    }

    if (!GEOAPIFY_API_KEY) {
      return NextResponse.json({ error: "Missing GEOAPIFY_API_KEY" }, { status: 500 })
    }

    const cacheKey = town.toLowerCase()
    const cached = streetCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ addresses: cached.data })
    }

    const allFeatures: any[] = []
    const limit = 100
    const maxResults = 2000
    let offset = 0

    while (offset < maxResults) {
      const params = new URLSearchParams({
        city: town,
        type: "street",
        limit: limit.toString(),
        offset: offset.toString(),
        lang: "sr",
        apiKey: GEOAPIFY_API_KEY,
        filter: "countrycode:rs",
      })

      const url = `${GEOAPIFY_GEOCODE_URL}?${params.toString()}`
      console.log("[v0] Fetching streets from Geoapify:", url.replace(GEOAPIFY_API_KEY, "***"))

      const response = await fetch(url)

      console.log("[v0] Geoapify response status:", response.status)

      if (!response.ok) {
        const errorData = await response.text()
        console.error("[v0] Geoapify API error:", errorData)
        throw new Error("Failed to fetch addresses")
      }

      const data = await response.json()
      const features = Array.isArray(data?.features) ? data.features : []
      allFeatures.push(...features)

      if (features.length < limit) {
        break
      }

      offset += limit
    }

    const addresses = buildStreetList(allFeatures)
    streetCache.set(cacheKey, { data: addresses, cachedAt: Date.now() })

    console.log("[v0] Returning addresses:", addresses.length)
    console.log("[v0] Sample addresses:", addresses.slice(0, 3))
    return NextResponse.json({ addresses })
  } catch (error) {
    console.error("[v0] Address autocomplete error:", error)
    return NextResponse.json({ error: "Failed to fetch addresses" }, { status: 500 })
  }
}
