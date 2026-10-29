import { NextResponse } from "next/server"
import places from "@/lib/data/serbia-places.json"

// Cities, towns and villages in Serbia with their Latin names and municipality, exported from OpenStreetMap
// by scripts/build-places.mjs.
// Bundled instead of queried live: the Overpass query takes ~50 s and often times out, which left the town dropdown empty.
export async function GET() {
  return NextResponse.json({ places })
}
