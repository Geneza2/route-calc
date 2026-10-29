// ~10 km around a place, enough to cover a town and its streets
const NEAR_RADIUS_DEG = 0.1

// Parses a "lon,lat" query parameter
export const parseNear = (value: string | null): [number, number] | undefined => {
  if (!value) return undefined
  const [lon, lat] = value.split(",").map(Number)
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : undefined
}

// Nominatim viewbox format: left,top,right,bottom
export const nearViewbox = ([lon, lat]: [number, number]) =>
  [lon - NEAR_RADIUS_DEG, lat + NEAR_RADIUS_DEG, lon + NEAR_RADIUS_DEG, lat - NEAR_RADIUS_DEG].join(",")
