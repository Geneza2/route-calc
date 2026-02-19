const DEFAULT_ORS_BASE_URL = "https://api.openrouteservice.org"
const DEFAULT_ORS_PROFILE_TRUCK = "driving-hgv"
const DEFAULT_ORS_PROFILE_CAR = "driving-car"

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "")

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

export const buildOrsRouteUrl = (config: { baseUrl: string; profile: string }, query?: string) => {
  const { baseUrl, profile } = config
  const suffix = query ? `?${query}` : ""
  return `${baseUrl}/v2/directions/${profile}/geojson${suffix}`
}
