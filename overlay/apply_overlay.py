#!/usr/bin/env python3
"""
Bake Amsterdam's "snorfiets naar de rijbaan" law into the OSM graph.

Problem: Valhalla's motor_scooter costing respects OSM `moped=*` access tags, but
OSM tagging of where snorfietsen may/may not ride inside the Ring A10 is incomplete
and inconsistent. The municipality publishes the authoritative road set:
    https://maps.amsterdam.nl/snorfietsnaarrijbaan/

This script rewrites the OSM extract so that:
  * cycleways covered by the rule get `moped=no`  (forces snorfiets onto the road)
  * the parallel rijbaan keeps moped access            (so a road route exists)
The exception streets (where snorfiets stays on the path) are left untouched.

Run:
    pip install -r requirements.txt
    python apply_overlay.py \
        --in  ../valhalla/tiles/noord-holland-latest.osm.pbf \
        --rule rijbaan_rule.geojson \
        --out ../valhalla/tiles/amsterdam-scooter.osm.pbf

NOTE (M2 verification still required):
  The exact WFS/GeoJSON endpoint, layer name, and which attribute distinguishes
  "rule applies" vs "exception" must be confirmed from the dataset itself before
  this is trusted. The fetch helper and the spatial-join thresholds below are
  marked with TODO where that confirmation is needed.
"""

import argparse
import sys

# Spatial libs: pyosmium for OSM I/O, shapely for geometry, a prepared spatial
# index for the rule geometries. Kept as imports-with-guidance so the file is
# readable before deps are installed.
try:
    import osmium  # pyosmium
    import shapely  # noqa: F401
    from shapely.geometry import LineString, shape
    from shapely.strtree import STRtree
    import json
except ImportError:
    print("Install deps first:  pip install -r requirements.txt", file=sys.stderr)
    raise

# How close (in metres) a cycleway must run to a rule road to be considered the
# same corridor. TODO(M2): tune against known streets (Weesperzijde, Sarphatistraat…).
PARALLEL_BUFFER_M = 15.0


def load_rule_geometries(path):
    """Load the municipal rule road set as a list of (geom, applies) tuples."""
    with open(path) as f:
        gj = json.load(f)
    rules = []
    for feat in gj["features"]:
        geom = shape(feat["geometry"])
        props = feat.get("properties", {})
        # TODO(M2): confirm the real property name. The dataset distinguishes
        # streets where snorfiets moves to the road from the few exceptions.
        applies = props.get("snorfiets_naar_rijbaan", True)
        rules.append((geom, applies))
    return rules


class OverlayHandler(osmium.SimpleHandler):
    """Sets moped=no on cycleways that fall under the rule."""

    def __init__(self, writer, rule_tree, rule_meta):
        super().__init__()
        self.writer = writer
        self.rule_tree = rule_tree
        self.rule_meta = rule_meta  # parallel list: applies flag per geom
        self.modified = 0

    def way(self, w):
        tags = dict(w.tags)
        if tags.get("highway") == "cycleway" and self._under_rule(w):
            tags["moped"] = "no"
            self.modified += 1
        self.writer.add_way(w.replace(tags=tags))

    def _under_rule(self, w):
        try:
            coords = [(n.lon, n.lat) for n in w.nodes if n.location.valid()]
        except osmium.InvalidLocationError:
            return False
        if len(coords) < 2:
            return False
        line = LineString(coords)
        # Rough metres->degrees near Amsterdam (lat ~52.37). Good enough for a 15m buffer.
        buf = PARALLEL_BUFFER_M / 111_000.0
        for idx in self.rule_tree.query(line):
            if self.rule_meta[idx] and self.rule_tree.geometries[idx].distance(line) < buf:
                return True
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--rule", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    rules = load_rule_geometries(args.rule)
    geoms = [g for g, _ in rules]
    meta = [applies for _, applies in rules]
    tree = STRtree(geoms)

    writer = osmium.SimpleWriter(args.out)
    handler = OverlayHandler(writer, tree, meta)
    # locations=True so way nodes carry coordinates for the spatial test.
    handler.apply_file(args.inp, locations=True)
    writer.close()
    print(f"Done. Set moped=no on {handler.modified} cycleway segments -> {args.out}")


if __name__ == "__main__":
    main()
