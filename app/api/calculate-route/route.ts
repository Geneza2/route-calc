import { type NextRequest, NextResponse } from "next/server"
import { buildOrsRouteUrl, getOrsConfig } from "@/lib/ors-server"

export async function POST(request: NextRequest) {
  try {
    const { waypoints, isTruck } = await request.json()
    const mode = isTruck === false ? "car" : "truck"

    console.log("[v0] Calculate route API called with waypoints:", waypoints?.length || 0)

    if (!waypoints || waypoints.length < 2) {
      console.log("[v0] Error: Not enough waypoints")
      return NextResponse.json({ error: "At least 2 waypoints required" }, { status: 400 })
    }

    const { baseUrl, profile, apiKey } = getOrsConfig(mode)
    if (!apiKey) {
      console.error("[v0] Missing ORS_KEY for routing")
      return NextResponse.json({ error: "Routing provider unavailable" }, { status: 500 })
    }

    const url = buildOrsRouteUrl({ baseUrl, profile })
    console.log("[v0] Fetching route from ORS:", { baseUrl, profile, url })

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coordinates: waypoints }),
    })

    console.log("[v0] ORS route response status:", response.status)

    if (!response.ok) {
      const errorData = await response.text()
      console.error("[v0] ORS route API error:", errorData)
      throw new Error("Failed to calculate route")
    }

    const data = await response.json()
    const feature = data?.features?.[0]
    const geometry = feature?.geometry
    const summary = feature?.properties?.summary

    if (geometry && summary?.distance != null) {
      const result = {
        distance: summary.distance / 1000,
        duration: summary.duration / 60,
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
