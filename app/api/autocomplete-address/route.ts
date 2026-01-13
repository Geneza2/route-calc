import { type NextRequest, NextResponse } from "next/server"

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const OVERPASS_URL = "https://overpass-api.de/api/interpreter"
const USER_AGENT = "truck-route-calculator"
const CYRILLIC_REGEX = /[\u0400-\u04FF]/

type AddressOption = {
  address: string
  coordinates: [number, number]
  street?: string
}

type TownBounds = {
  south: number
  west: number
  north: number
  east: number
}

const pickLatinTag = (tags: Record<string, string>, key: string) => {
  const latin = tags[`${key}:sr-Latn`] ?? tags[`${key}:latin`]
  if (latin && latin.trim()) return latin.trim()
  const fallback = tags[key]
  if (fallback && fallback.trim() && !CYRILLIC_REGEX.test(fallback)) return fallback.trim()
  return undefined
}

const parseBounds = (bbox: string[]): TownBounds | null => {
  if (!Array.isArray(bbox) || bbox.length < 4) return null
  const south = Number(bbox[0])
  const north = Number(bbox[1])
  const west = Number(bbox[2])
  const east = Number(bbox[3])
  if (![south, north, west, east].every((value) => Number.isFinite(value))) return null
  return { south, west, north, east }
}

const fetchTownBounds = async (town: string): Promise<TownBounds | null> => {
  const params = new URLSearchParams({
    q: `${town}, Serbia`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
    countrycodes: "rs",
    "accept-language": "sr-Latn",
  })
  const url = `${NOMINATIM_URL}?${params.toString()}`
  console.log("[v0] Fetching town bounds from Nominatim:", url)

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "sr-Latn",
    },
  })

  if (!response.ok) {
    const errorData = await response.text()
    console.error("[v0] Nominatim town error:", errorData)
    throw new Error("Failed to fetch town bounds")
  }

  const data = await response.json()
  if (!Array.isArray(data) || data.length === 0) return null

  return parseBounds(data[0]?.boundingbox)
}

const buildStreetList = (elements: any[]) => {
  const seen = new Set<string>()
  const addresses: AddressOption[] = []

  elements.forEach((element) => {
    const tags = element?.tags || {}
    const street = pickLatinTag(tags, "name")
    if (!street) return

    const lon = Number(element?.center?.lon ?? element?.lon)
    const lat = Number(element?.center?.lat ?? element?.lat)
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return

    const key = street.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)

    addresses.push({
      address: street,
      coordinates: [lon, lat],
      street,
    })
  })

  return addresses.sort((a, b) => a.address.localeCompare(b.address))
}

const fetchStreets = async (bounds: TownBounds) => {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  const query = [
    "[out:json][timeout:60];",
    "(",
    `  way["highway"]["name"](${bbox});`,
    `  way["highway"]["name:sr-Latn"](${bbox});`,
    `  way["highway"]["name:latin"](${bbox});`,
    ");",
    "out center tags;",
  ].join("\n")

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  })

  if (!response.ok) {
    const errorData = await response.text()
    console.error("[v0] Overpass streets error:", errorData)
    throw new Error("Failed to fetch streets")
  }

  const data = await response.json()
  const elements = Array.isArray(data?.elements) ? data.elements : []
  return buildStreetList(elements)
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

    const bounds = await fetchTownBounds(town)
    if (!bounds) {
      return NextResponse.json({ addresses: [] })
    }

    const addresses = await fetchStreets(bounds)

    console.log("[v0] Returning addresses:", addresses.length)
    console.log("[v0] Sample addresses:", addresses.slice(0, 3))
    return NextResponse.json({ addresses })
  } catch (error) {
    console.error("[v0] Address autocomplete error:", error)
    return NextResponse.json({ error: "Failed to fetch addresses" }, { status: 500 })
  }
}
