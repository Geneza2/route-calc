import { type NextRequest, NextResponse } from "next/server"
import { buildOrsRouteUrl, getOrsConfig } from "@/lib/ors-server"

export async function POST(request: NextRequest) {
  try {
    const { from, to, isTruck } = await request.json()
    const mode = isTruck === false ? "car" : "truck"

    console.log("[v0] Calculate distance API called")
    console.log("[v0] From coordinates:", from)
    console.log("[v0] To coordinates:", to)

    if (!from || !to || from.length !== 2 || to.length !== 2) {
      console.log("[v0] Invalid coordinates provided")
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
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
      body: JSON.stringify({ coordinates: [from, to] }),
    })

    console.log("[v0] ORS response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] ORS error:", errorText)
      throw new Error("Failed to calculate route")
    }

    const data = await response.json()
    const feature = data?.features?.[0]
    const summary = feature?.properties?.summary
    if (summary?.distance != null) {
      const distanceKm = summary.distance / 1000
      const durationMin = summary.duration ? summary.duration / 60 : undefined

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
