"use client"

import { useEffect, useMemo, useState } from "react"
import MapLibreGL from "maplibre-gl"
import { Loader2 } from "lucide-react"
import type { Stop } from "./route-manager"
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerPopup,
  useMap,
} from "@/components/ui/map"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"

interface RouteMapProps {
  stops: Stop[]
  onRemoveStop: (id: string) => void
}

const STARTING_POINT: Stop = {
  id: "starting-point",
  buyer: t("startingPoint"),
  town: "Kanjiža",
  address: "Put Narodnih Heroja 17, Kanjiža",
  coordinates: [20.0597, 46.0697],
}

const DEFAULT_CENTER: [number, number] = [20.4651, 44.0165]
const SERBIA_BOUNDS: MapLibreGL.LngLatBoundsLike = [
  [18.8, 42.2],
  [23.0, 46.2],
]

const extractRouteCoordinates = (geometry?: {
  type?: string
  coordinates?: unknown
}): [number, number][] => {
  if (!geometry || !geometry.coordinates) return []

  if (geometry.type === "LineString") {
    return geometry.coordinates as [number, number][]
  }

  if (geometry.type === "MultiLineString") {
    return (geometry.coordinates as [number, number][][]).flat()
  }

  return []
}

function RouteViewport({ stops }: { stops: Stop[] }) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return

    const validStops = stops.filter((stop) => stop.coordinates)
    if (validStops.length === 0) {
      map.easeTo({ center: DEFAULT_CENTER, zoom: 7, duration: 800 })
      return
    }

    if (validStops.length === 1) {
      map.easeTo({
        center: validStops[0].coordinates as [number, number],
        zoom: 11,
        duration: 800,
      })
      return
    }

    const bounds = new MapLibreGL.LngLatBounds()
    validStops.forEach((stop) => {
      bounds.extend(stop.coordinates as [number, number])
    })

    map.fitBounds(bounds, { padding: 80, duration: 900, maxZoom: 12 })
  }, [map, isLoaded, stops])

  return null
}

export default function RouteMap({ stops }: RouteMapProps) {
  const allStops = useMemo(() => [STARTING_POINT, ...stops], [stops])
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([])
  const [routeDistance, setRouteDistance] = useState(0)
  const [isRouting, setIsRouting] = useState(false)

  useEffect(() => {
    let isActive = true
    const validStops = allStops.filter((stop) => stop.coordinates)

    setRouteCoordinates([])
    setRouteDistance(0)

    if (validStops.length < 2) {
      return () => {
        isActive = false
      }
    }

    setIsRouting(true)
    const waypoints = validStops.map((stop) => stop.coordinates as [number, number])

    fetch("/api/calculate-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Route request failed")
        }
        return response.json()
      })
      .then((data) => {
        if (!isActive) return

        const distance = typeof data.distance === "number" ? data.distance : 0
        setRouteDistance(distance)

        const coordinates = extractRouteCoordinates(data.geometry)
        setRouteCoordinates(coordinates)
      })
      .catch((error) => {
        if (!isActive) return
        console.error("[v0] Failed to calculate route:", error)
      })
      .finally(() => {
        if (!isActive) return
        setIsRouting(false)
      })

    return () => {
      isActive = false
    }
  }, [allStops])

  const hasSummary = routeDistance > 0

  return (
    <div className="relative h-full min-h-[400px] bg-muted/40">
      <Map
        center={DEFAULT_CENTER}
        zoom={7}
        minZoom={6}
        maxZoom={18}
        maxBounds={SERBIA_BOUNDS}
        maxBoundsViscosity={0.9}
      >
        <MapControls position="bottom-right" showZoom showLocate showFullscreen />
        <RouteViewport stops={allStops} />

        {routeCoordinates.length > 1 && (
          <MapRoute coordinates={routeCoordinates} color="#16a34a" width={4} opacity={0.85} />
        )}

        {allStops.map((stop, index) => {
          if (!stop.coordinates) return null
          const isStarting = index === 0

          return (
            <MapMarker
              key={stop.id}
              longitude={stop.coordinates[0]}
              latitude={stop.coordinates[1]}
            >
              <MarkerContent className="group">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-semibold shadow-lg transition-transform group-hover:scale-105",
                    isStarting ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground",
                  )}
                >
                  {isStarting ? "S" : index}
                </div>
              </MarkerContent>
              <MarkerPopup closeButton>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{stop.buyer}</p>
                  <p className="text-xs text-muted-foreground">{stop.address}</p>
                  <p className="text-xs text-muted-foreground">{stop.town}</p>
                </div>
              </MarkerPopup>
            </MapMarker>
          )
        })}
      </Map>

      {(hasSummary || isRouting) && (
        <div className="absolute left-4 top-4 z-10 rounded-lg border bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("routeSummary")}
          </p>
          <div className="mt-2 flex items-center gap-6">
            <div>
              <p className="text-[10px] text-muted-foreground">{t("distanceLabel")}</p>
              <p className="text-sm font-semibold">
                {routeDistance ? `${routeDistance.toFixed(1)} km` : "--"}
              </p>
            </div>
          </div>
          {isRouting && (
            <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("calculatingRoute")}
            </div>
          )}
        </div>
      )}
    </div>
  )
}




