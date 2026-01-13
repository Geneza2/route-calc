import { NextResponse } from "next/server"

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || ""

export async function GET() {
  console.log("[v0] Map config API called, API key exists:", !!GEOAPIFY_API_KEY)
  return NextResponse.json({ apiKey: GEOAPIFY_API_KEY })
}
