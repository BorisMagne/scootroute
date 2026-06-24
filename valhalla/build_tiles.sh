#!/usr/bin/env bash
# Build Valhalla routing tiles for the Amsterdam region.
#
# Steps:
#   1. Download the Noord-Holland OSM extract from Geofabrik.
#   2. (M2) Apply the Amsterdam scooter-law overlay to the .pbf.
#   3. Build Valhalla tiles from the resulting .pbf inside the official image.
#
# Output: ./valhalla/tiles/  (mounted into the valhalla service)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TILES_DIR="$HERE/tiles"
RAW_PBF="$TILES_DIR/noord-holland-latest.osm.pbf"
# Switch to the overlaid file once overlay/apply_overlay.py is verified (M2).
SRC_PBF="$RAW_PBF"
# SRC_PBF="$TILES_DIR/amsterdam-scooter.osm.pbf"

EXTRACT_URL="https://download.geofabrik.de/europe/netherlands/noord-holland-latest.osm.pbf"

mkdir -p "$TILES_DIR"

if [[ ! -f "$RAW_PBF" ]]; then
  echo ">> Downloading Noord-Holland extract (~150 MB)…"
  curl -L --fail -o "$RAW_PBF" "$EXTRACT_URL"
else
  echo ">> Extract already present, skipping download."
fi

echo ">> Building Valhalla tiles (this can take several minutes)…"
docker run --rm -v "$TILES_DIR:/data" ghcr.io/valhalla/valhalla:latest \
  bash -c "
    cd /data &&
    valhalla_build_config --mjolnir-tile-dir /data/valhalla_tiles \
        --mjolnir-tile-extract /data/valhalla_tiles.tar \
        --mjolnir-timezone /data/valhalla_tiles/timezones.sqlite \
        --mjolnir-admin /data/valhalla_tiles/admins.sqlite > /data/valhalla.json &&
    valhalla_build_tiles -c /data/valhalla.json /data/$(basename "$SRC_PBF") &&
    find /data/valhalla_tiles | sort -n | valhalla_build_extract -c /data/valhalla.json -v
  "

echo ">> Done. Tiles in $TILES_DIR. Start with: docker compose up -d valhalla"
