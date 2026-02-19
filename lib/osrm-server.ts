const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org"
const DEFAULT_OSRM_PROFILE = "driving"

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "")

export const getOsrmConfig = () => {
  const baseUrl = normalizeBaseUrl(process.env.OSRM_BASE_URL || DEFAULT_OSRM_BASE_URL)
  const profile = process.env.OSRM_PROFILE || DEFAULT_OSRM_PROFILE
  return { baseUrl, profile }
}

export const buildOsrmRouteUrl = (coordinates: string, query: string) => {
  const { baseUrl, profile } = getOsrmConfig()
  return `${baseUrl}/route/v1/${profile}/${coordinates}?${query}`
}
