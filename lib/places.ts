export interface Place {
  name: string
  coordinates: [number, number]
  municipality?: string
  district?: string
  postcode?: string
}

const CHOICES_STORAGE_KEY = "town-choices"

// Several places share a name (e.g. "Rača"), so a place is identified by its coordinates
export const placeKey = (place: Place) => place.coordinates.join(",")

export const placeRegion = (place: Place) => [place.municipality, place.district].filter(Boolean).join(", ")

export const normalizeTownName = (town: string) => town.trim().toLowerCase()

export const findPlacesByName = (places: Place[], town: string) => {
  const name = normalizeTownName(town)
  return places.filter((place) => normalizeTownName(place.name) === name)
}

// The municipality the user picked last time for an ambiguous town name, keyed by normalized name
export const loadTownChoices = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(CHOICES_STORAGE_KEY) || "{}")
  } catch {
    return {}
  }
}

export const saveTownChoices = (choices: Map<string, Place>) => {
  try {
    const stored = loadTownChoices()
    choices.forEach((place, name) => {
      stored[normalizeTownName(name)] = placeKey(place)
    })
    localStorage.setItem(CHOICES_STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Storage may be unavailable (private window); choices are then asked again next time
  }
}
