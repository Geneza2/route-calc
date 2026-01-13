import { type NextRequest, NextResponse } from "next/server"

const OVERPASS_URL = "https://overpass-api.de/api/interpreter"
const USER_AGENT = "truck-route-calculator"
const CYRILLIC_REGEX = /[\u0400-\u04FF]/
const PLACE_PREFIX = /^(Grad|Op\u0161tina|\u0413\u0440\u0430\u0434|\u041e\u043f\u0448\u0442\u0438\u043d\u0430)\s+/i

type PlaceOption = {
  name: string
  coordinates: [number, number]
  postcode?: string
}

const pickLatinTag = (tags: Record<string, string>, key: string) => {
  const latin = tags[`${key}:sr-Latn`] ?? tags[`${key}:latin`]
  if (latin && latin.trim()) return latin.trim()
  const fallback = tags[key]
  if (fallback && fallback.trim() && !CYRILLIC_REGEX.test(fallback)) return fallback.trim()
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

const fetchPlaces = async () => {
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
    console.error("[v0] Overpass places error:", errorData)
    throw new Error("Failed to fetch places")
  }

  const data = await response.json()
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

  return places.sort((a, b) => a.name.localeCompare(b.name))
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
