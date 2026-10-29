// Regenerates lib/data/serbia-places.json from OpenStreetMap (Overpass).
// Usage: node scripts/build-places.mjs   (both queries together take a few minutes)
import fs from "node:fs"

const OVERPASS_URL = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter"
const OUTPUT = new URL("../lib/data/serbia-places.json", import.meta.url)
const PLACE_PREFIX = /^(Grad|Opština)\s+/i

const overpass = async (query) => {
  // The public server often answers 429/502/504 when busy; back off and retry
  for (let attempt = 0, wait = 15000; ; attempt++, wait *= 2) {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "truck-route-calculator" },
      body: `data=${encodeURIComponent(query)}`,
    })
    if (response.ok) return (await response.json()).elements
    if (attempt >= 5 || ![429, 502, 503, 504].includes(response.status)) {
      throw new Error(`Overpass error ${response.status}: ${await response.text()}`)
    }
    console.log(`Overpass busy (${response.status}), retrying in ${wait / 1000} s`)
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
}

const SERBIA = 'area["ISO3166-1"="RS"][admin_level=2]->.rs;'
const PLACE_FILTER = '["place"~"^(city|town|village)$"]'

console.log("Fetching places...")
const placeElements = await overpass(
  `[out:json][timeout:300];${SERBIA}nwr${PLACE_FILTER}(area.rs);out center tags;`,
)

// Serbia: admin_level 6 = upravni okrug, 7 = grad, 8 = opština (or gradska opština inside a grad)
console.log("Fetching districts and municipalities...")
const adminElements = await overpass(
  [
    "[out:json][timeout:900];",
    SERBIA,
    'rel(area.rs)[boundary=administrative][admin_level~"^(6|7|8)$"];',
    "map_to_area->.adm;",
    "foreach.adm->.a(.a out tags;",
    `  nwr${PLACE_FILTER}(area.a);`,
    "  out ids;",
    ");",
  ].join("\n"),
)

const adminByPlace = new Map()
let currentArea = null
for (const element of adminElements) {
  if (element.type === "area") {
    currentArea = element.tags
    continue
  }
  const key = `${element.type}/${element.id}`
  const levels = adminByPlace.get(key) ?? {}
  levels[currentArea.admin_level] = (currentArea["name:sr-Latn"] || currentArea.name).trim()
  adminByPlace.set(key, levels)
}

// A town is often mapped twice (place node and boundary), a few hundred metres apart
const DUPLICATE_DISTANCE_DEG = 0.05
const isDuplicate = (a, b) =>
  a.name === b.name &&
  a.municipality === b.municipality &&
  Math.abs(a.coordinates[0] - b.coordinates[0]) < DUPLICATE_DISTANCE_DEG &&
  Math.abs(a.coordinates[1] - b.coordinates[1]) < DUPLICATE_DISTANCE_DEG

const seen = new Set()
const places = []
for (const element of placeElements) {
  const tags = element.tags || {}
  const raw = tags["name:sr-Latn"]
  if (!raw) continue

  const name = raw.trim().replace(PLACE_PREFIX, "").trim()
  const lon = Number(element.lon ?? element.center?.lon)
  const lat = Number(element.lat ?? element.center?.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue

  const coordinates = [Number(lon.toFixed(5)), Number(lat.toFixed(5))]
  const key = `${name}:${coordinates.join(",")}`
  if (seen.has(key)) continue
  seen.add(key)

  const levels = adminByPlace.get(`${element.type}/${element.id}`) ?? {}
  const place = { name, coordinates }
  // A grad is better known than its gradske opštine, so it wins over level 8
  const municipality = levels["7"] || levels["8"]
  if (municipality) place.municipality = municipality
  if (levels["6"]) place.district = levels["6"].replace(/\s+upravni okrug$/i, " okrug")
  const postcode = tags["addr:postcode"] || tags.postal_code
  if (postcode) place.postcode = postcode
  // Overpass lists nodes first, so the place node wins over a way or relation centre
  if (places.some((existing) => isDuplicate(existing, place))) continue
  places.push(place)
}

places.sort((a, b) => a.name.localeCompare(b.name, "sr-Latn"))
fs.writeFileSync(OUTPUT, JSON.stringify(places) + "\n")
console.log(
  `Wrote ${places.length} places, ${places.filter((place) => place.municipality).length} with a municipality`,
)
