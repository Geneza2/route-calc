import { type NextRequest, NextResponse } from "next/server"
import { buildOsrmRouteUrl, getOsrmConfig } from "@/lib/osrm-server"

export async function POST(request: NextRequest) {
  try {
    const { from, to } = await request.json()

    console.log("[v0] Calculate distance API called")
    console.log("[v0] From coordinates:", from)
    console.log("[v0] To coordinates:", to)

    if (!from || !to || from.length !== 2 || to.length !== 2) {
      console.log("[v0] Invalid coordinates provided")
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
    }

    const coordinates = `${from[0]},${from[1]};${to[0]},${to[1]}`
    const url = buildOsrmRouteUrl(coordinates, "overview=false")
    const { baseUrl, profile } = getOsrmConfig()
    console.log("[v0] Fetching route from OSRM:", { baseUrl, profile, url })

    const response = await fetch(url)

    console.log("[v0] OSRM response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OSRM error:", errorText)
      throw new Error("Failed to calculate route")
    }

    const data = await response.json()
    const route = data?.routes?.[0]
    if (route?.distance != null) {
      const distanceKm = route.distance / 1000
      const durationMin = route.duration ? route.duration / 60 : undefined

      console.log("[v0] Distance calculated:", distanceKm, "km")
      return NextResponse.json({
        distance: distanceKm,
        duration: durationMin,
      })
    }

    console.log("[v0] No route found in response")
    return NextResponse.json({ error: "No route found" }, { status: 404 })
  } catch (error) {
    console.error("[v0] Distance calculation error:", error)
    return NextResponse.json({ error: "Failed to calculate distance" }, { status: 500 })
  }
}
