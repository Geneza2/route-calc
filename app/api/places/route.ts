import { type NextRequest, NextResponse } from "next/server"

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || ""
const GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"

type PlaceOption = {
  name: string
  coordinates: [number, number]
  postcode?: string
}

const MAX_RESULTS = 5000
const PAGE_LIMIT = 200
const PLACE_PREFIX = /^(Grad|Op\u0161tina|\u0413\u0440\u0430\u0434|\u041e\u043f\u0448\u0442\u0438\u043d\u0430)\s+/i

const pickLatinValue = (props: Record<string, any>, key: string) => {
  const latin = props[`${key}:sr-Latn`] ?? props[`${key}:latin`]
  if (typeof latin === "string" && latin.trim()) {
    return latin.trim()
  }
  const fallback = props[key]
  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim()
  }
  return undefined
}

const isAllowedCategory = (props: Record<string, any>) => {
  const categories = Array.isArray(props.categories) ? props.categories : []
  if (categories.length === 0) {
    return Boolean(props.city || props.town || props.village)
  }
  return categories.some((category) =>
    ["populated_place.city", "populated_place.town", "populated_place.village"].includes(category),
  )
}

const extractPlace = (feature: any): PlaceOption | null => {
  const props = feature?.properties || {}
  if (!isAllowedCategory(props)) return null
  const rawName =
    pickLatinValue(props, "name") ||
    pickLatinValue(props, "city") ||
    pickLatinValue(props, "town") ||
    pickLatinValue(props, "village")

  if (!rawName) return null

  const name = rawName.replace(PLACE_PREFIX, "").trim()
  const lon = Number(props.lon)
  const lat = Number(props.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null

  return {
    name,
    coordinates: [lon, lat],
    postcode: props.postcode,
  }
}

const fetchPlaces = async () => {
  const categories = [
    "populated_place.city",
    "populated_place.town",
    "populated_place.village",
  ].join(",")

  const results: PlaceOption[] = []
  const seen = new Set<string>()
  let offset = 0

  while (offset < MAX_RESULTS) {
    const params = new URLSearchParams({
      categories,
      filter: "rect:18.8,42.2,23.0,46.2",
      limit: PAGE_LIMIT.toString(),
      offset: offset.toString(),
      lang: "sr",
      apiKey: GEOAPIFY_API_KEY,
    })

    const url = `${GEOAPIFY_PLACES_URL}?${params.toString()}`
    console.log("[v0] Fetching places from Geoapify:", url.replace(GEOAPIFY_API_KEY, "***"))

    const response = await fetch(url)

    if (!response.ok) {
      const errorData = await response.text()
      console.error("[v0] Geoapify places error:", errorData)
      throw new Error("Failed to fetch places")
    }

    const data = await response.json()
    const features = Array.isArray(data?.features) ? data.features : []

    features.forEach((feature: any) => {
      const place = extractPlace(feature)
      if (!place) return
      const key = place.postcode ? `postcode:${place.postcode}` : `${place.name}:${place.coordinates.join(",")}`
      if (seen.has(key)) return
      seen.add(key)
      results.push(place)
    })

    if (features.length < PAGE_LIMIT) {
      break
    }

    offset += PAGE_LIMIT
  }

  return results.sort((a, b) => a.name.localeCompare(b.name))
}

export async function GET(_: NextRequest) {
  try {
    if (!GEOAPIFY_API_KEY) {
      return NextResponse.json({ error: "Missing GEOAPIFY_API_KEY" }, { status: 500 })
    }

    const places = await fetchPlaces()

    return NextResponse.json({ places })
  } catch (error) {
    console.error("[v0] Places preload error:", error)
    return NextResponse.json({ error: "Failed to preload places" }, { status: 500 })
  }
}
