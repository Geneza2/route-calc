"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { t } from "@/lib/i18n"
import { type Place, loadTownChoices, normalizeTownName, placeKey, placeRegion } from "@/lib/places"

export interface TownChoice {
  name: string
  options: Place[]
  stopCount: number
}

interface TownChoiceDialogProps {
  choices: TownChoice[] | null
  onComplete: (choices: Map<string, Place> | null) => void
}

// Asks which municipality is meant for every imported town name that matches several places
export function TownChoiceDialog({ choices, onComplete }: TownChoiceDialogProps) {
  const [selected, setSelected] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!choices) return
    // Preselect the municipality picked last time for the same name
    const remembered = loadTownChoices()
    const initial: Record<string, string> = {}
    choices.forEach((choice) => {
      const key = remembered[normalizeTownName(choice.name)]
      if (choice.options.some((option) => placeKey(option) === key)) initial[choice.name] = key
    })
    setSelected(initial)
  }, [choices])

  const isComplete = choices?.every((choice) => selected[choice.name]) ?? false

  const handleComplete = () => {
    if (!choices) return
    const result = new Map<string, Place>()
    choices.forEach((choice) => {
      const place = choice.options.find((option) => placeKey(option) === selected[choice.name])
      if (place) result.set(choice.name, place)
    })
    onComplete(result)
  }

  return (
    <Dialog open={choices !== null} onOpenChange={(open) => !open && onComplete(null)}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto z-[100]">
        <DialogHeader>
          <DialogTitle>{t("chooseMunicipalityTitle")}</DialogTitle>
          <DialogDescription>{t("chooseMunicipalityDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {choices?.map((choice) => (
            <div key={choice.name} className="space-y-1">
              <Label className="font-medium">
                {choice.name}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({t("stopsInFile")}: {choice.stopCount})
                </span>
              </Label>
              <Select
                value={selected[choice.name]}
                onValueChange={(value) => setSelected({ ...selected, [choice.name]: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("selectMunicipalityPlaceholder")} />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[150]">
                  {choice.options.map((option) => (
                    <SelectItem key={placeKey(option)} value={placeKey(option)} className="text-xs">
                      {placeRegion(option) || option.coordinates.join(", ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onComplete(null)}>
            {t("cancel")}
          </Button>
          <Button onClick={handleComplete} disabled={!isComplete}>
            {t("continueImport")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
