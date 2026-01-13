import { type NextRequest, NextResponse } from "next/server"

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || ""

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get("address")

    console.log("[v0] Geocode API called with address:", address)

    if (!address) {
      console.log("[v0] Error: Address parameter missing")
      return NextResponse.json({ error: "Address parameter is required" }, { status: 400 })
    }

    const strategies = [
      // Strategy 1: Full address with country filter
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&filter=countrycode:rs&apiKey=${GEOAPIFY_API_KEY}`,
      // Strategy 2: Address with Serbia explicitly in text
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address + ", Serbia")}&apiKey=${GEOAPIFY_API_KEY}`,
    ]

    for (let i = 0; i < strategies.length; i++) {
      const url = strategies[i]
      console.log(`[v0] Trying geocoding strategy ${i + 1}:`, url.replace(GEOAPIFY_API_KEY, "***"))

      const response = await fetch(url)
      console.log(`[v0] Geocode response status (strategy ${i + 1}):`, response.status)

      if (!response.ok) {
        console.log(`[v0] Strategy ${i + 1} failed with status:`, response.status)
        continue
      }

      const data = await response.json()
      console.log(`[v0] Geocode features found (strategy ${i + 1}):`, data.features?.length || 0)

      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        const [lon, lat] = feature.geometry.coordinates
        const resultType = feature.properties?.result_type || "unknown"
        console.log(`[v0] Geocoded coordinates (${resultType}):`, { lon, lat })

        // Warn if we only got city-level coordinates
        if (resultType === "city" || resultType === "locality") {
          console.log(`[v0] Warning: Only got ${resultType}-level coordinates, not street-level`)
        }

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
