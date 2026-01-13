export async function geocodeAddress(address: string): Promise<[number, number] | undefined> {
  try {
    const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
    const data = await response.json()

    if (data.coordinates) {
      return data.coordinates
    }
  } catch (error) {
    console.error("Geocoding error:", error)
  }
  return undefined
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
