import { t } from "@/lib/i18n"

// Every route starts here
export const STARTING_POINT = {
  id: "starting-point",
  buyer: t("startingPoint"),
  town: "Kelebija",
  address: "Put Edvarda Kardelja 305, Kelebija",
  coordinates: [19.589374, 46.141326] as [number, number],
}

// Always the first delivery stop, before all other stops
export const FIRST_STOP = {
  id: "first-stop",
  buyer: t("firstStop"),
  town: "Kanjiža",
  address: "Put Narodnih Heroja 17, Kanjiža",
  coordinates: [20.039037, 46.05133] as [number, number],
}

export const FIXED_STOPS = [STARTING_POINT, FIRST_STOP]
