"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Plus, Trash2, Loader2, Check, ChevronsUpDown, Pencil, X, GripVertical, Calculator } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"
import type { Stop } from "./route-manager"
import { geocodeAddress } from "@/lib/geoapify"
import * as XLSX from "xlsx"
import { ColumnMappingDialog } from "./column-mapping-dialog"

interface RouteFormProps {
  onAddStop: (stop: Stop) => void
  stops: Stop[]
  onClearRoute: () => void
  onReorderStops: (stops: Stop[]) => void
}

interface AddressOption {
  address: string
  coordinates: [number, number]
  street?: string
  housenumber?: string
}

interface ExcelRow {
  [key: string]: string | number
}

interface TownOption {
  name: string
  coordinates: [number, number]
  postcode?: string
}

const STARTING_POINT = {
  id: "starting-point",
  buyer: t("startingPoint"),
  town: "Kanjiža",
  address: "Put Narodnih Heroja 17, Kanjiža",
  coordinates: [20.0597, 46.0697] as [number, number],
}

const offsetDuplicateCoordinates = (stopsToOffset: Stop[]): Stop[] => {
  const coordinateMap = new Map<string, Stop[]>()

  // Group stops by coordinates
  stopsToOffset.forEach((stop) => {
    if (stop.coordinates) {
      const key = `${stop.coordinates[0]},${stop.coordinates[1]}`
      if (!coordinateMap.has(key)) {
        coordinateMap.set(key, [])
      }
      coordinateMap.get(key)!.push(stop)
    }
  })

  // Offset stops with duplicate coordinates
  const offsetStops = [...stopsToOffset]
  coordinateMap.forEach((stops, key) => {
    if (stops.length > 1) {
      console.log(`[v0] Found ${stops.length} stops at same coordinates:`, key)
      stops.forEach((stop, index) => {
        if (index > 0) {
          // Add small offset (approximately 100-200 meters)
          const offsetLon = (Math.random() - 0.5) * 0.003
          const offsetLat = (Math.random() - 0.5) * 0.003
          const stopIndex = offsetStops.findIndex((s) => s.id === stop.id)
          if (stopIndex !== -1 && offsetStops[stopIndex].coordinates) {
            const [lon, lat] = offsetStops[stopIndex].coordinates!
            offsetStops[stopIndex] = {
              ...offsetStops[stopIndex],
              coordinates: [lon + offsetLon, lat + offsetLat] as [number, number],
            }
            console.log(`[v0] Offset stop ${stop.buyer} by [${offsetLon.toFixed(4)}, ${offsetLat.toFixed(4)}]`)
          }
        }
      })
    }
  })

  return offsetStops
}

export default function RouteForm({ onAddStop, stops, onClearRoute, onReorderStops }: RouteFormProps) {
  const [formData, setFormData] = useState({
    buyer: "",
    town: "",
    address: "",
  })

  const [townOpen, setTownOpen] = useState(false)
  const [townSearch, setTownSearch] = useState("")
  const [townOptions, setTownOptions] = useState<TownOption[]>([])
  const [isLoadingTowns, setIsLoadingTowns] = useState(false)
  const [addressOpen, setAddressOpen] = useState(false)
  const [addressSearch, setAddressSearch] = useState("")
  const [addresses, setAddresses] = useState<AddressOption[]>([])
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [excelData, setExcelData] = useState<ExcelRow[]>([])
  const [excelColumns, setExcelColumns] = useState<string[]>([])
  const [showColumnMapping, setShowColumnMapping] = useState(false)
  const [editingStopId, setEditingStopId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    buyer: "",
    town: "",
    address: "",
  })

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })

  useEffect(() => {
    setIsLoadingTowns(true)
    fetch("/api/places")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.places)) {
          setTownOptions(data.places)
        } else {
          setTownOptions([])
        }
      })
      .catch((error) => {
        console.error("[v0] Error fetching towns:", error)
        setTownOptions([])
      })
      .finally(() => {
        setIsLoadingTowns(false)
      })
  }, [])

  useEffect(() => {
    if (!formData.town) {
      setAddresses([])
      return
    }

    console.log("[v0] Preloading streets for town:", formData.town)
    setIsLoadingAddresses(true)
    fetch(`/api/autocomplete-address?town=${encodeURIComponent(formData.town)}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("[v0] Streets received:", data.addresses?.length || 0)
        if (data.addresses) {
          setAddresses(data.addresses)
        } else {
          setAddresses([])
        }
      })
      .catch((error) => {
        console.error("[v0] Error fetching streets:", error)
        setAddresses([])
      })
      .finally(() => {
        setIsLoadingAddresses(false)
      })
  }, [formData.town])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[v0] Submitting new stop:", formData)
    setIsSubmitting(true)

    try {
      let coordinates: [number, number] | undefined
      const selectedAddress = addresses.find((addr) => addr.address === formData.address)

      if (selectedAddress && selectedAddress.coordinates[0] !== 0) {
        console.log("[v0] Using coordinates from selected address:", selectedAddress.coordinates)
        coordinates = selectedAddress.coordinates
      } else {
        console.log("[v0] Geocoding address:", formData.address)
        coordinates = await geocodeWithFallback(formData.address, formData.town)
        console.log("[v0] Geocoded coordinates:", coordinates)
      }

      const newStop: Stop = {
        id: Date.now().toString() + Math.random(),
        ...formData,
        coordinates,
        distanceFromPrevious: undefined, // Don't calculate yet
      }

      console.log("[v0] Adding new stop without distance calculation:", newStop)
      onAddStop(newStop)

      setFormData({
        buyer: "",
        town: "",
        address: "",
      })
      setTownSearch("")
      setAddressSearch("")
    } catch (error) {
      console.error("Error adding stop:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log("[v0] Reading Excel file:", file.name)

    if (stops.length > 0) {
      console.log("[v0] Clearing", stops.length, "existing stops before importing new file")
      onClearRoute()
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: "binary" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[]

        console.log("[v0] Excel data parsed:", jsonData.length, "rows")
        if (jsonData.length > 0) {
          const columns = Object.keys(jsonData[0])
          console.log("[v0] Excel columns:", columns)
          setExcelData(jsonData)
          setExcelColumns(columns)
          setShowColumnMapping(true)
        }
      } catch (error) {
        console.error("[v0] Error reading Excel file:", error)
      }
    }
    reader.readAsBinaryString(file)
  }

  const geocodeWithFallback = async (address: string, town: string) => {
    const fullAddress = `${address}, ${town}, Serbia`
    let coordinates = await geocodeAddress(fullAddress)

    if (!coordinates || (coordinates[0] === 0 && coordinates[1] === 0)) {
      console.log("[v0] Falling back to town geocode:", town)
      coordinates = await geocodeAddress(`${town}, Serbia`)
    }

    return coordinates
  }

  const calculateStraightLineDistance = (coord1: [number, number], coord2: [number, number]): number => {
    const [lon1, lat1] = coord1
    const [lon2, lat2] = coord2

    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c

    return distance
  }

  const optimizeRouteOrder = (stopsToOptimize: Stop[]): Stop[] => {
    if (stopsToOptimize.length <= 1) {
      console.log("[v0] Not enough stops to optimize")
      return stopsToOptimize
    }

    console.log("[v0] Starting route optimization for", stopsToOptimize.length, "stops")

    const unvisited = [...stopsToOptimize]
    const optimized: Stop[] = []
    let currentPosition = STARTING_POINT.coordinates

    while (unvisited.length > 0) {
      let nearestIndex = 0
      let nearestDistance = Number.POSITIVE_INFINITY

      // Find the nearest unvisited stop
      for (let i = 0; i < unvisited.length; i++) {
        const stop = unvisited[i]
        if (stop.coordinates) {
          const distance = calculateStraightLineDistance(currentPosition, stop.coordinates)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestIndex = i
          }
        }
      }

      // Move the nearest stop to optimized array
      const [nearestStop] = unvisited.splice(nearestIndex, 1)
      optimized.push(nearestStop)
      currentPosition = nearestStop.coordinates || currentPosition

      console.log(
        `[v0] Added stop ${optimized.length}: ${nearestStop.buyer} (${nearestDistance.toFixed(1)} km from previous)`,
      )
    }

    console.log("[v0] Route optimization complete.", optimized.map((s) => s.buyer).join(" -> "))
    return optimized
  }

  const handleColumnMappingComplete = async (mapping: Record<string, string>) => {
    console.log("[v0] Column mapping:", mapping)
    setShowColumnMapping(false)
    setIsImporting(true)
    setImportProgress({ current: 0, total: excelData.length })

    let processedCount = 0
    let skippedCount = 0
    let failedCount = 0
    const importedStops: Stop[] = []

    try {
      for (let index = 0; index < excelData.length; index++) {
        const row = excelData[index]
        const stopData = {
          buyer: row[mapping.buyer]?.toString().trim() || "",
          town: row[mapping.town]?.toString().trim() || "",
          address: row[mapping.address]?.toString().trim() || "",
        }

        if (!stopData.buyer || !stopData.town || !stopData.address) {
          console.log("[v0] Skipping empty row:", stopData)
          skippedCount++
          setImportProgress({ current: index + 1, total: excelData.length })
          continue
        }

        console.log("[v0] Processing Excel row:", stopData)
        processedCount++

        try {
          const fullAddress = `${stopData.address}, ${stopData.town}, Serbia`
          console.log(`[v0] Geocoding address ${processedCount}:`, fullAddress)
          const coordinates = await geocodeWithFallback(stopData.address, stopData.town)

          if (!coordinates || (coordinates[0] === 0 && coordinates[1] === 0)) {
            console.error(`[v0] Failed to geocode address ${processedCount}:`, fullAddress)
            failedCount++
            setImportProgress({ current: index + 1, total: excelData.length })
            continue
          }

          console.log(`[v0] Successfully geocoded ${processedCount}:`, coordinates)

          const newStop: Stop = {
            id: Date.now().toString() + Math.random(),
            ...stopData,
            coordinates,
            distanceFromPrevious: undefined,
          }

          importedStops.push(newStop)
          setImportProgress({ current: index + 1, total: excelData.length })
          await new Promise((resolve) => setTimeout(resolve, 300)) // Increased delay to avoid rate limiting
        } catch (error) {
          console.error(`[v0] Error processing Excel row ${processedCount}:`, error)
          failedCount++
          setImportProgress({ current: index + 1, total: excelData.length })
        }
      }
    } finally {
      setIsImporting(false)
    }

    console.log(
      `[v0] Import complete: ${processedCount} rows processed, ${importedStops.length} imported, ${skippedCount} skipped (empty), ${failedCount} failed (geocoding)`,
    )

    if (importedStops.length > 0) {
      console.log("[v0] Offsetting duplicate coordinates")
      const offsetStops = offsetDuplicateCoordinates(importedStops)

      console.log("[v0] Optimizing route order for imported stops")
      const optimizedStops = optimizeRouteOrder(offsetStops)

      // Add all optimized stops
      for (const stop of optimizedStops) {
        onAddStop(stop)
      }
    }
  }

  const townSearchTerm = townSearch.trim().toLowerCase()
  const filteredTowns = townOptions.filter((town) =>
    town.name.toLowerCase().includes(townSearchTerm),
  )
  const addressSearchTerm = addressSearch.trim().toLowerCase()
  const filteredAddresses =
    addressSearchTerm.length === 0
      ? addresses
      : addresses.filter((addr) => addr.address.toLowerCase().includes(addressSearchTerm))

  const allStops = [STARTING_POINT, ...stops]
  const importPercent =
    importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0

  const totalDistance = stops.reduce((sum, stop) => sum + (stop.distanceFromPrevious || 0), 0)
  console.log("[v0] Total distance calculated:", totalDistance, "km")

  const calculateAllDistances = async () => {
    console.log("[v0] Manually calculating all distances")
    setIsCalculating(true)

    try {
      console.log("[v0] Optimizing route order before distance calculation")
      const optimizedStops = optimizeRouteOrder(stops)

      // Recalculate distances for optimized route
      const updatedStops = await recalculateDistances(optimizedStops)
      onReorderStops(updatedStops)
      console.log("[v0] Distance calculation complete")
    } catch (error) {
      console.error("[v0] Error calculating distances:", error)
    } finally {
      setIsCalculating(false)
    }
  }

  const recalculateDistances = async (stopsToUpdate: Stop[]): Promise<Stop[]> => {
    const updatedStops = [...stopsToUpdate]
    let calculatedCount = 0
    let failedCount = 0

    console.log(`[v0] Starting distance calculation for ${updatedStops.length} stops`)

    for (let i = 0; i < updatedStops.length; i++) {
      const currentStop = updatedStops[i]
      const prevStop = i === 0 ? STARTING_POINT : updatedStops[i - 1]

      if (!currentStop.coordinates) {
        console.error(`[v0] Stop ${i + 1} (${currentStop.buyer}) has no coordinates, skipping distance calculation`)
        failedCount++
        continue
      }

      if (!prevStop.coordinates) {
        console.error(`[v0] Previous stop has no coordinates, skipping distance calculation for stop ${i + 1}`)
        failedCount++
        continue
      }

      console.log(`[v0] Calculating distance from stop ${i} to stop ${i + 1}`)
      try {
        const response = await fetch("/api/calculate-distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: prevStop.coordinates,
            to: currentStop.coordinates,
          }),
        })

        if (!response.ok) {
          console.error(`[v0] Distance API returned error for stop ${i + 1}:`, response.status)
          failedCount++
          continue
        }

        const data = await response.json()
        updatedStops[i] = { ...currentStop, distanceFromPrevious: data.distance }
        calculatedCount++
        console.log(`[v0] Distance for stop ${i + 1}:`, data.distance, "km")
      } catch (error) {
        console.error(`[v0] Error calculating distance for stop ${i + 1}:`, error)
        failedCount++
      }
    }

    console.log(`[v0] Distance calculation complete: ${calculatedCount} calculated, ${failedCount} failed`)
    return updatedStops
  }

  const removeStop = (index: number) => {
    if (index === 0) return // Can't remove starting point
    const newStops = stops.filter((_, i) => i !== index - 1)
    onReorderStops(newStops)
  }

  const startEditing = (stop: Stop, index: number) => {
    if (index === 0) return // Can't edit starting point
    console.log("[v0] Starting edit for stop:", stop.id)
    setEditingStopId(stop.id)
    setEditFormData({
      buyer: stop.buyer,
      town: stop.town,
      address: stop.address,
    })
  }

  const cancelEditing = () => {
    console.log("[v0] Canceling edit")
    setEditingStopId(null)
    setEditFormData({ buyer: "", town: "", address: "" })
  }

  const saveEdit = async (stopId: string, index: number) => {
    console.log("[v0] Saving edit for stop:", stopId, editFormData)
    setIsSubmitting(true)

    try {
      const coordinates = await geocodeWithFallback(editFormData.address, editFormData.town)

      const actualIndex = index - 1 // Adjust for starting point
      const newStops = [...stops]

      newStops[actualIndex] = {
        ...newStops[actualIndex],
        buyer: editFormData.buyer,
        town: editFormData.town,
        address: editFormData.address,
        coordinates,
        distanceFromPrevious: undefined, // Clear distance - will be recalculated manually
      }

      onReorderStops(newStops)

      setEditingStopId(null)
      setEditFormData({ buyer: "", town: "", address: "" })
    } catch (error) {
      console.error("[v0] Error saving edit:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (index === 0) return // Can't drag starting point
    console.log("[v0] Drag start:", index)
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (index === 0) return // Can't drop on starting point
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (dropIndex === 0 || draggedIndex === null || draggedIndex === 0) return

    console.log("[v0] Drop:", { from: draggedIndex, to: dropIndex })

    const newStops = [...stops]
    const draggedActualIndex = draggedIndex - 1 // Adjust for starting point
    const dropActualIndex = dropIndex - 1 // Adjust for starting point

    const [draggedItem] = newStops.splice(draggedActualIndex, 1)
    newStops.splice(dropActualIndex, 0, draggedItem)

    console.log("[v0] Reordered stops (distances not recalculated)")
    onReorderStops(newStops)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">{t("totalStops")}</p>
          <p className="text-2xl font-semibold">{allStops.length}</p>
          <p className="text-xs text-muted-foreground">
            {stops.length} {t("deliveryStopsSuffix")}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">{t("routeDistance")}</p>
          <p className="text-2xl font-semibold">{totalDistance > 0 ? `${totalDistance.toFixed(1)} km` : "--"}</p>
          <p className="text-xs text-muted-foreground">{t("calculatedOnDemand")}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">{t("quickActions")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {stops.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={calculateAllDistances}
                disabled={isCalculating}
                className="h-8 bg-transparent text-xs"
              >
                {isCalculating ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Calculator className="mr-1 h-3 w-3" />
                )}
                {t("calculateKm")}
              </Button>
            )}
            {stops.length > 0 && (
              <Button variant="destructive" size="sm" onClick={onClearRoute} className="h-8 text-xs">
                <Trash2 className="mr-1 h-3 w-3" />
                {t("clearAll")}
              </Button>
            )}
            {stops.length === 0 && <span className="text-xs text-muted-foreground">{t("addStopHint")}</span>}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {allStops.map((stop, index) => (
          <div
            key={stop.id}
            draggable={index > 0}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-background/90 p-3 shadow-sm transition-colors",
              index > 0 && "cursor-move hover:bg-muted/40",
              draggedIndex === index && "opacity-60",
            )}
          >
            {index > 0 ? (
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <div className="w-4 flex-shrink-0" />
            )}

            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold flex-shrink-0",
                index === 0 ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground",
              )}
            >
              {index === 0 ? "S" : index}
            </span>

            {editingStopId === stop.id ? (
              <>
                <div className="flex-1 min-w-0">
                  <Input
                    value={editFormData.buyer}
                    onChange={(e) => setEditFormData({ ...editFormData, buyer: e.target.value })}
                    className="h-8 text-xs"
                    placeholder={t("buyerLabel")}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Input
                    value={editFormData.town}
                    onChange={(e) => setEditFormData({ ...editFormData, town: e.target.value })}
                    className="h-8 text-xs"
                    placeholder={t("townLabel")}
                  />
                </div>
                <div className="flex-[1.5] min-w-0">
                  <Input
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="h-8 text-xs"
                    placeholder={t("addressLabel")}
                  />
                </div>
                <div className="w-20 flex-shrink-0" />
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-primary"
                    onClick={() => saveEdit(stop.id, index)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive"
                    onClick={cancelEditing}
                    disabled={isSubmitting}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{stop.buyer}</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm text-muted-foreground truncate">{stop.town}</div>
                </div>

                <div className="flex-[1.5] min-w-0">
                  <div className="text-sm text-muted-foreground truncate">{stop.address}</div>
                </div>

                {stop.distanceFromPrevious ? (
                  <div className="w-20 text-right flex-shrink-0">
                    <span className="text-xs font-medium text-primary">
                      +{stop.distanceFromPrevious.toFixed(1)} km
                    </span>
                  </div>
                ) : (
                  <div className="w-20 text-right flex-shrink-0">
                    <span className="text-xs text-muted-foreground">--</span>
                  </div>
                )}

                {index > 0 && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => startEditing(stop, index)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => removeStop(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {index === 0 && <div className="w-[88px] flex-shrink-0" />}
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.4fr_auto]">
          <div className="flex-1">
            <Label htmlFor="buyer" className="mb-1 block text-xs">
              {t("buyerLabel")}
            </Label>
            <Input
              id="buyer"
              value={formData.buyer}
              onChange={(e) => setFormData({ ...formData, buyer: e.target.value })}
              required
              placeholder={t("companyPlaceholder")}
              className="h-9 text-sm"
            />
          </div>

          <div className="flex-1">
            <Label htmlFor="town" className="mb-1 block text-xs">
              {t("townLabel")}
            </Label>
            <Popover open={townOpen} onOpenChange={setTownOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={townOpen}
                  className="h-9 w-full justify-between bg-transparent text-sm"
                >
                  <span className="truncate">{formData.town || t("selectPlaceholder")}</span>
                  <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={t("searchPlaceholder")}
                    value={townSearch}
                    onValueChange={setTownSearch}
                    className="h-9 text-sm"
                  />
                  <CommandList>
                    {isLoadingTowns ? (
                      <div className="flex items-center justify-center p-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-2 text-xs">{t("loading")}</span>
                      </div>
                    ) : (
                      <>
                        <CommandEmpty className="text-xs">{t("noTownFound")}</CommandEmpty>
                        <CommandGroup>
                          {filteredTowns.map((town) => (
                            <CommandItem
                              key={`${town.postcode ?? "no-postcode"}-${town.coordinates.join(",")}-${town.name}`}
                              value={town.name}
                              onSelect={(currentValue) => {
                                setFormData({ ...formData, town: currentValue, address: "" })
                                setTownSearch(currentValue)
                                setAddressSearch("")
                                setTownOpen(false)
                              }}
                              className="text-sm"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.town === town.name ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {town.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex-[1.5]">
            <Label htmlFor="address" className="mb-1 block text-xs">
              {t("addressLabel")}
            </Label>
            <Popover open={addressOpen} onOpenChange={setAddressOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={addressOpen}
                  className="h-9 w-full justify-between bg-transparent text-sm"
                  disabled={!formData.town}
                >
                  <span className="truncate">{formData.address || t("typeStreetPlaceholder")}</span>
                  <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={t("typeStreetNamePlaceholder")}
                    value={addressSearch}
                    onValueChange={setAddressSearch}
                    className="h-9 text-sm"
                  />
                  <CommandList>
                    {isLoadingAddresses ? (
                      <div className="flex items-center justify-center p-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-2 text-xs">{t("loading")}</span>
                      </div>
                    ) : (
                      <>
                        <CommandEmpty className="text-xs">{t("noStreetFound")}</CommandEmpty>
                        <CommandGroup>
                          {filteredAddresses.map((addr, index) => (
                            <CommandItem
                              key={index}
                              value={addr.address}
                              onSelect={(currentValue) => {
                                setFormData({ ...formData, address: currentValue })
                                setAddressOpen(false)
                              }}
                              className="text-sm"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.address === addr.address ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{addr.street || addr.address}</span>
                                {addr.housenumber && (
                                  <span className="text-xs text-muted-foreground">{addr.housenumber}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-end">
            <Button type="submit" className="h-9 px-4 text-sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addStop")}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      <div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full bg-transparent text-sm"
          onClick={() => document.getElementById("excel-upload")?.click()}
          disabled={isImporting}
        >
          <Upload className="mr-2 h-4 w-4" />
          {t("uploadExcelFile")}
        </Button>
        <input id="excel-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
        {isImporting && (
          <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t("importingStops")}</span>
              <span className="tabular-nums">
                {t("importProgress")} {importProgress.current}/{importProgress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${importPercent}%` }} />
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{importPercent}%</div>
          </div>
        )}
      </div>

      <ColumnMappingDialog
        open={showColumnMapping}
        onOpenChange={setShowColumnMapping}
        columns={excelColumns}
        onComplete={handleColumnMappingComplete}
      />
    </div>
  )
}




