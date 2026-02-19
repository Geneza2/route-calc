import { type NextRequest, NextResponse } from "next/server"

const OVERPASS_URLS = (process.env.OVERPASS_URLS ||
  "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.nchc.org.tw/api/interpreter"
)
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean)
const USER_AGENT = "truck-route-calculator"
const PLACE_PREFIX = /^(Grad|Op\u0161tina|\u0413\u0440\u0430\u0434|\u041e\u043f\u0448\u0442\u0438\u043d\u0430)\s+/i
const CACHE_TTL_MS = 1000 * 60 * 60 * 12

let cachedPlaces: PlaceOption[] | null = null
let cachedAt = 0

type PlaceOption = {
  name: string
  coordinates: [number, number]
  postcode?: string
}

const pickLatinTag = (tags: Record<string, string>, key: string) => {
  const latin = tags[`${key}:sr-Latn`]
  if (latin && latin.trim()) return latin.trim()
  return undefined
}

const isAllowedPlace = (tags: Record<string, string>) => {
  return ["city", "town", "village"].includes(tags.place)
}

const extractPlace = (element: any): PlaceOption | null => {
  const tags = element?.tags || {}
  if (!isAllowedPlace(tags)) return null

  const rawName =
    pickLatinTag(tags, "name") ||
    pickLatinTag(tags, "city") ||
    pickLatinTag(tags, "town") ||
    pickLatinTag(tags, "village")

  if (!rawName) return null

  const name = rawName.replace(PLACE_PREFIX, "").trim()
  const lon = Number(element?.lon ?? element?.center?.lon)
  const lat = Number(element?.lat ?? element?.center?.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null

  const postcode = tags["addr:postcode"] || tags.postal_code

  return {
    name,
    coordinates: [lon, lat],
    postcode,
  }
}

const fetchWithTimeout = async (url: string, body: string) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

const fetchPlaces = async () => {
  if (cachedPlaces && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedPlaces
  }

  const query = [
    "[out:json][timeout:60];",
    'area["ISO3166-1"="RS"][admin_level=2]->.searchArea;',
    "(",
    '  node["place"~"^(city|town|village)$"](area.searchArea);',
    '  way["place"~"^(city|town|village)$"](area.searchArea);',
    '  relation["place"~"^(city|town|village)$"](area.searchArea);',
    ");",
    "out center tags;",
  ].join("\n")

  const body = `data=${encodeURIComponent(query)}`
  let lastError: unknown = null
  let data: any = null

  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetchWithTimeout(url, body)
      if (!response.ok) {
        const errorData = await response.text()
        console.error("[v0] Overpass places error:", { url, status: response.status, errorData })
        lastError = new Error(`Overpass error ${response.status}`)
        continue
      }
      data = await response.json()
      break
    } catch (error) {
      console.error("[v0] Overpass places request failed:", { url, error })
      lastError = error
    }
  }

  if (!data) {
    throw lastError ?? new Error("Failed to fetch places")
  }

  const elements = Array.isArray(data?.elements) ? data.elements : []
  const seen = new Set<string>()
  const places: PlaceOption[] = []

  elements.forEach((element: any) => {
    const place = extractPlace(element)
    if (!place) return
    const key = place.postcode
      ? `postcode:${place.postcode}`
      : `${place.name}:${place.coordinates.join(",")}`
    if (seen.has(key)) return
    seen.add(key)
    places.push(place)
  })

  const sorted = places.sort((a, b) => a.name.localeCompare(b.name))
  cachedPlaces = sorted
  cachedAt = Date.now()
  return sorted
}

export async function GET(_: NextRequest) {
  try {
    const places = await fetchPlaces()
    return NextResponse.json({ places })
  } catch (error) {
    console.error("[v0] Places preload error:", error)
    return NextResponse.json({ error: "Failed to preload places" }, { status: 500 })
  }
}
