import { type NextRequest, NextResponse } from "next/server"

const buildOsrmUrl = (waypoints: [number, number][]) => {
  const coordinates = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";")
  return `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&alternatives=false`
}

export async function POST(request: NextRequest) {
  try {
    const { waypoints } = await request.json()

    console.log("[v0] Calculate route API called with waypoints:", waypoints?.length || 0)

    if (!waypoints || waypoints.length < 2) {
      console.log("[v0] Error: Not enough waypoints")
      return NextResponse.json({ error: "At least 2 waypoints required" }, { status: 400 })
    }

    const url = buildOsrmUrl(waypoints)
    console.log("[v0] Fetching route from OSRM:", url)

    const response = await fetch(url)

    console.log("[v0] OSRM route response status:", response.status)

    if (!response.ok) {
      const errorData = await response.text()
      console.error("[v0] OSRM route API error:", errorData)
      throw new Error("Failed to calculate route")
    }

    const data = await response.json()
    const route = data?.routes?.[0]
    const geometry = route?.geometry

    if (geometry) {
      const result = {
        distance: route.distance / 1000, // Convert to km
        duration: route.duration / 60, // Convert to minutes
        geometry,
      }
      console.log("[v0] Route calculated:", { distance: result.distance, duration: result.duration })
      return NextResponse.json(result)
    }

    console.log("[v0] No route found")
    return NextResponse.json({ error: "No route found" }, { status: 404 })
  } catch (error) {
    console.error("[v0] Route calculation error:", error)
    return NextResponse.json({ error: "Failed to calculate route" }, { status: 500 })
  }
}
