const DEFAULT_ORS_BASE_URL = "https://api.openrouteservice.org"
const DEFAULT_ORS_PROFILE_TRUCK = "driving-hgv"
const DEFAULT_ORS_PROFILE_CAR = "driving-car"

// 40 t semi-trailer (EU limits); override per deployment with ORS_TRUCK_* env vars
const DEFAULT_TRUCK_RESTRICTIONS = {
  weight: 40, // t
  axleload: 11.5, // t
  height: 4, // m
  width: 2.55, // m
  length: 16.5, // m
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "")

const readNumberEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export type OrsMode = "truck" | "car"

export const getOrsConfig = (mode: OrsMode = "truck") => {
  const baseUrl = normalizeBaseUrl(process.env.ORS_BASE_URL || DEFAULT_ORS_BASE_URL)
  const profile =
    mode === "car"
      ? process.env.ORS_CAR_PROFILE || DEFAULT_ORS_PROFILE_CAR
      : process.env.ORS_PROFILE || DEFAULT_ORS_PROFILE_TRUCK
  const apiKey = process.env.ORS_KEY
  return { baseUrl, profile, apiKey }
}

export const getTruckRestrictions = () => ({
  weight: readNumberEnv("ORS_TRUCK_WEIGHT", DEFAULT_TRUCK_RESTRICTIONS.weight),
  axleload: readNumberEnv("ORS_TRUCK_AXLELOAD", DEFAULT_TRUCK_RESTRICTIONS.axleload),
  height: readNumberEnv("ORS_TRUCK_HEIGHT", DEFAULT_TRUCK_RESTRICTIONS.height),
  width: readNumberEnv("ORS_TRUCK_WIDTH", DEFAULT_TRUCK_RESTRICTIONS.width),
  length: readNumberEnv("ORS_TRUCK_LENGTH", DEFAULT_TRUCK_RESTRICTIONS.length),
})

export const buildOrsRouteUrl = (config: { baseUrl: string; profile: string }, query?: string) => {
  const { baseUrl, profile } = config
  const suffix = query ? `?${query}` : ""
  return `${baseUrl}/v2/directions/${profile}/geojson${suffix}`
}

export const buildOrsRouteBody = (coordinates: [number, number][], profile: string) => {
  // Repeated stops at the same spot add nothing to the route
  const waypoints = coordinates.filter(
    (point, index) => index === 0 || point[0] !== coordinates[index - 1][0] || point[1] !== coordinates[index - 1][1],
  )

  // Without explicit restrictions ORS ignores maxweight/maxaxleload/maxheight/maxlength tags
  if (profile !== "driving-hgv") {
    return { coordinates: waypoints }
  }

  return {
    coordinates: waypoints,
    options: {
      vehicle_type: "hgv",
      profile_params: {
        restrictions: getTruckRestrictions(),
      },
    },
  }
}
