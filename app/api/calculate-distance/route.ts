import { type NextRequest, NextResponse } from "next/server"

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || ""

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

    const waypointsParam = `${from[1]},${from[0]}|${to[1]},${to[0]}`
    const url = `https://api.geoapify.com/v1/routing?waypoints=${waypointsParam}&mode=drive&type=balanced&apiKey=${GEOAPIFY_API_KEY}`

    console.log("[v0] Fetching route from Geoapify:", url.replace(GEOAPIFY_API_KEY, "***"))

    const response = await fetch(url)

    console.log("[v0] Geoapify response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Geoapify error:", errorText)
      throw new Error("Failed to calculate route")
    }

    const data = await response.json()
    console.log("[v0] Route features found:", data.features?.length || 0)

    if (data.features && data.features.length > 0) {
      const properties = data.features[0].properties
      const distanceKm = properties.distance / 1000
      const durationMin = properties.time / 60

      console.log("[v0] Distance calculated:", distanceKm, "km")
      console.log("[v0] Duration calculated:", durationMin, "minutes")

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
