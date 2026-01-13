import { type NextRequest, NextResponse } from "next/server"

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const USER_AGENT = "truck-route-calculator"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get("address")

    console.log("[v0] Geocode API called with address:", address)

    if (!address) {
      console.log("[v0] Error: Address parameter missing")
      return NextResponse.json({ error: "Address parameter is required" }, { status: 400 })
    }

    const strategies = [address, `${address}, Serbia`]

    for (let i = 0; i < strategies.length; i++) {
      const params = new URLSearchParams({
        q: strategies[i],
        format: "jsonv2",
        addressdetails: "1",
        limit: "1",
        countrycodes: "rs",
        "accept-language": "sr-Latn",
      })
      const url = `${NOMINATIM_URL}?${params.toString()}`

      console.log(`[v0] Trying geocoding strategy ${i + 1}:`, url)

      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
        },
      })
      console.log(`[v0] Nominatim response status (strategy ${i + 1}):`, response.status)

      if (!response.ok) {
        console.log(`[v0] Strategy ${i + 1} failed with status:`, response.status)
        continue
      }

      const data = await response.json()
      console.log(`[v0] Nominatim results found (strategy ${i + 1}):`, Array.isArray(data) ? data.length : 0)

      if (Array.isArray(data) && data.length > 0) {
        const result = data[0]
        const lon = Number(result.lon)
        const lat = Number(result.lat)
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
          console.log("[v0] Invalid coordinates returned by Nominatim")
          continue
        }

        console.log(`[v0] Geocoded coordinates:`, { lon, lat })
        return NextResponse.json({ coordinates: [lon, lat] })
      }
    }

    console.log("[v0] All geocoding strategies failed - address not found")
    return NextResponse.json({ error: "Address not found" }, { status: 404 })
  } catch (error) {
    console.error("[v0] Geocoding error:", error)
    return NextResponse.json({ error: "Failed to geocode address" }, { status: 500 })
  }
}
