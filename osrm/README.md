# OSRM Truck Backend

This folder contains OSRM data inputs and a custom truck profile.

## Files
- `serbia-latest.osm.pbf` OSM extract (input data)
- `profiles/truck.lua` Custom truck profile (40t / 15m)

## Build the OSRM dataset
Run these in order:

```bash
docker compose -f docker-compose.osrm.yml run --rm osrm-extract
docker compose -f docker-compose.osrm.yml run --rm osrm-partition
docker compose -f docker-compose.osrm.yml run --rm osrm-customize
```

## Start the OSRM server
```bash
docker compose -f docker-compose.osrm.yml up osrm-routed
```

The server will be available at `http://localhost:5000`.

## PowerShell script (Windows)
```powershell
.\scripts\osrm.ps1 -Action build
.\scripts\osrm.ps1 -Action run
# or one-shot:
.\scripts\osrm.ps1 -Action all
```
