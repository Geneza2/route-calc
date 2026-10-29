// Nominatim usage policy allows at most 1 request per second
const GEOCODE_MIN_INTERVAL_MS = 1100

const geocodeCache = new Map<string, Promise<[number, number] | undefined>>()
let nextGeocodeSlot = 0

const waitForGeocodeSlot = async () => {
  const now = Date.now()
  const wait = Math.max(0, nextGeocodeSlot - now)
  nextGeocodeSlot = Math.max(now, nextGeocodeSlot) + GEOCODE_MIN_INTERVAL_MS
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
}

// `near` limits results to the surroundings of a known place, so a street is not found in a namesake town
export async function geocodeAddress(
  address: string,
  near?: [number, number],
): Promise<[number, number] | undefined> {
  const key = [address.trim().toLowerCase(), near?.join(",")].filter(Boolean).join("@")
  const cached = geocodeCache.get(key)
  if (cached) return cached

  const request = (async () => {
    await waitForGeocodeSlot()
    try {
      const params = new URLSearchParams({ address })
      if (near) params.set("near", near.join(","))
      const response = await fetch(`/api/geocode?${params.toString()}`)
      const data = await response.json()

      if (data.coordinates) {
        return data.coordinates as [number, number]
      }
      // Only cache "not found"; rate limits and server errors may succeed on retry
      if (response.status !== 404) {
        geocodeCache.delete(key)
      }
    } catch (error) {
      console.error("Geocoding error:", error)
      geocodeCache.delete(key)
    }
    return undefined
  })()

  geocodeCache.set(key, request)
  return request
}

export async function calculateRoute(
  waypoints: [number, number][],
): Promise<{ distance: number; duration: number; geometry: any } | null> {
  if (waypoints.length < 2) return null

  try {
    const response = await fetch("/api/calculate-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints }),
    })
    const data = await response.json()

    if (data.geometry) {
      return {
        distance: data.distance,
        duration: data.duration,
        geometry: data.geometry,
      }
    }
  } catch (error) {
    console.error("Routing error:", error)
  }
  return null
}
