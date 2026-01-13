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

const REQUIRED_FIELDS = [
  { key: "buyer", labelKey: "buyerLabel" },
  { key: "town", labelKey: "townLabel" },
  { key: "address", labelKey: "addressLabel" },
] as const

export function ColumnMappingDialog({ open, onOpenChange, columns, onComplete }: ColumnMappingDialogProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      console.log("[v0] Column mapping dialog opened")
      console.log("[v0] Available columns:", columns)
      console.log("[v0] Number of columns:", columns.length)
    }
  }, [open, columns])

  const handleComplete = () => {
    console.log("[v0] Column mapping completed:", mapping)
    onComplete(mapping)
    setMapping({})
  }

  const handleMappingChange = (fieldKey: string, value: string) => {
    console.log("[v0] Mapping changed:", { field: fieldKey, column: value })
    setMapping({ ...mapping, [fieldKey]: value })
  }

  const isComplete = REQUIRED_FIELDS.every((field) => mapping[field.key])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto z-[100]">
        <DialogHeader>
          <DialogTitle>{t("mapExcelColumns")}</DialogTitle>
          <DialogDescription>{t("mapExcelDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {REQUIRED_FIELDS.map((field) => (
            <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
              <Label htmlFor={field.key} className="text-right font-medium">
                {t(field.labelKey)}
              </Label>
              <Select value={mapping[field.key]} onValueChange={(value) => handleMappingChange(field.key, value)}>
                <SelectTrigger id={field.key} className="w-full">
                  <SelectValue placeholder={t("selectColumnPlaceholder")} />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[150]">
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
            {t("importStops")} ({REQUIRED_FIELDS.filter((f) => mapping[f.key]).length}/{REQUIRED_FIELDS.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
