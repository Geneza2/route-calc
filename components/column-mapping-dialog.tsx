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

interface ColumnMappingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: string[]
  onComplete: (mapping: Record<string, string>) => void
}

const COLUMN_FIELDS = [
  { key: "buyer", labelKey: "buyerLabel", required: true, match: /kupac|buyer|customer/i },
  { key: "town", labelKey: "townLabel", required: true, match: /mesto|grad|town|city/i },
  { key: "address", labelKey: "addressLabel", required: false, match: /adresa|address|kontakt|napomena/i },
] as const

// Radix Select does not allow an empty item value
const NO_COLUMN = "__none__"

export function ColumnMappingDialog({ open, onOpenChange, columns, onComplete }: ColumnMappingDialogProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    console.log("[v0] Column mapping dialog opened with columns:", columns)

    // Preselect columns whose header matches a known name (e.g. KUPAC, Mesto, Kontakt/napomena)
    const guessed: Record<string, string> = {}
    COLUMN_FIELDS.forEach((field) => {
      const column = columns.find((name) => field.match.test(name))
      guessed[field.key] = column ?? (field.required ? "" : NO_COLUMN)
    })
    setMapping(guessed)
  }, [open, columns])

  const handleComplete = () => {
    const finalMapping = Object.fromEntries(
      Object.entries(mapping).filter(([, column]) => column && column !== NO_COLUMN),
    )
    console.log("[v0] Column mapping completed:", finalMapping)
    onComplete(finalMapping)
  }

  const handleMappingChange = (fieldKey: string, value: string) => {
    console.log("[v0] Mapping changed:", { field: fieldKey, column: value })
    setMapping({ ...mapping, [fieldKey]: value })
  }

  const isComplete = COLUMN_FIELDS.filter((field) => field.required).every((field) => mapping[field.key])
  const mappedRequiredCount = COLUMN_FIELDS.filter((field) => field.required && mapping[field.key]).length
  const requiredCount = COLUMN_FIELDS.filter((field) => field.required).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto z-[100]">
        <DialogHeader>
          <DialogTitle>{t("mapExcelColumns")}</DialogTitle>
          <DialogDescription>{t("mapExcelDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {COLUMN_FIELDS.map((field) => (
            <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
              <Label htmlFor={field.key} className="text-right font-medium">
                {t(field.labelKey)}
              </Label>
              <Select value={mapping[field.key]} onValueChange={(value) => handleMappingChange(field.key, value)}>
                <SelectTrigger id={field.key} className="w-full">
                  <SelectValue placeholder={t("selectColumnPlaceholder")} />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[150]">
                  {!field.required && (
                    <SelectItem value={NO_COLUMN} className="text-xs text-muted-foreground">
                      {t("noColumn")}
                    </SelectItem>
                  )}
                  {columns.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground">{t("noColumnsAvailable")}</div>
                  ) : (
                    columns.map((column) => (
                      <SelectItem key={column} value={column} className="text-xs">
                        {column}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={handleComplete} disabled={!isComplete}>
            {t("importStops")} ({mappedRequiredCount}/{requiredCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
