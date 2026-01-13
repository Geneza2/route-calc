import { type NextRequest, NextResponse } from "next/server"

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

const extractTownName = (item: any) => {
  const address = item?.address || {}
  const raw =
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.suburb ||
    item?.name ||
    (typeof item?.display_name === "string" ? item.display_name.split(",")[0]?.trim() : undefined)
  if (!raw) return undefined
  return raw.replace(/^(Grad|Opština)\s+/i, "").trim()
}

const isTownLike = (item: any) => {
  const type = item?.type || item?.addresstype
  const isPlace = item?.class === "place"
  return isPlace && ["city", "town", "village", "suburb", "hamlet"].includes(type)
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("query")?.trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ towns: [] })
    }

    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      countrycodes: "rs",
      limit: "20",
      "accept-language": "sr-Latn",
    })

    const url = `${NOMINATIM_URL}?${params.toString()}`
    console.log("[v0] Fetching towns from Nominatim:", url)

    const response = await fetch(url, {
      headers: {
        "User-Agent": "truck-route-calculator",
      },
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("[v0] Nominatim API error:", errorData)
      throw new Error("Failed to fetch towns")
    }

    const data = await response.json()
    const seen = new Set<string>()
    const towns: string[] = []

    if (Array.isArray(data)) {
      data.forEach((item) => {
        if (!isTownLike(item)) return
        const name = extractTownName(item)
        if (!name || seen.has(name)) return
        seen.add(name)
        towns.push(name)
      })
    }

    return NextResponse.json({ towns })
  } catch (error) {
    console.error("[v0] Town search error:", error)
    return NextResponse.json({ error: "Failed to fetch towns" }, { status: 500 })
  }
}
