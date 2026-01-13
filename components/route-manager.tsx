"use client";

import { useState } from "react";
import RouteForm from "@/components/route-form";
import RouteMap from "@/components/route-map";
import { Card } from "@/components/ui/card";
import { Truck } from "lucide-react";
import { t } from "@/lib/i18n";

export interface Stop {
  id: string;
  buyer: string;
  town: string;
  address: string;
  coordinates?: [number, number];
  distanceFromPrevious?: number;
}

export default function RouteManager() {
  const [stops, setStops] = useState<Stop[]>([]);

  const addStop = (stop: Stop) => {
    setStops((prev) => [...prev, stop]);
  };

  const removeStop = (id: string) => {
    setStops((prev) => prev.filter((stop) => stop.id !== id));
  };

  const clearRoute = () => {
    setStops([]);
  };

  const reorderStops = (newStops: Stop[]) => {
    setStops(newStops);
  };

  return (
    <div className="relative min-h-screen xl:h-screen xl:max-h-screen xl:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.16),transparent_55%)]" />
      <div className="relative flex min-h-screen flex-col xl:h-full xl:flex-row">
        <aside className="flex w-full flex-col gap-5 px-5 py-5 xl:w-1/2 xl:gap-6 xl:px-10 xl:py-8">
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {t("routePlannerTitle")}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                {t("activeStops")}: {stops.length}
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {t("readyToRoute")}
              </div>
            </div>
          </header>

          <div className="space-y-6 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-2">
            <RouteForm
              onAddStop={addStop}
              stops={stops}
              onClearRoute={clearRoute}
              onReorderStops={reorderStops}
            />
          </div>
        </aside>

        <section className="h-[50vh] min-h-90 w-full xl:h-full xl:w-1/2">
          <Card className="h-full overflow-hidden rounded-none border-l bg-card/80 shadow-sm">
            <RouteMap stops={stops} onRemoveStop={removeStop} />
          </Card>
        </section>
      </div>
    </div>
  );
}
