#!/usr/bin/env python3
"""
Regenerate src/data/cohort_ecdf/ from the _aggregated export's bins.

    python3 scripts/refresh-cohort-ecdf.py [--dry-run]

WHY THIS EXISTS
---------------
The Distributions tab reads per-parameter ECDF CSVs of the shape

    value,emory_probability,mimic_probability,...

Those were hand-derived once and had no reproducible source. The _aggregated
export ships the underlying histogram bins as Parquet, so the CSVs can be
regenerated — and the derivation is checkable rather than trusted.

THE DERIVATION
--------------
Each bins Parquet has one row per (segment, bin) with a `count__<Site>` column
per site. Bin edges are site-specific: a site's own bins are exactly the rows
where its count is non-null (13-15 of them), and they run below -> normal ->
above with bin_max ascending. The ECDF for a site is therefore the cumulative
sum of its counts divided by its total, evaluated at each of its bin_max values
— which is what an ECDF *is* at those points, not an approximation of one.

Sites are written as lowercase codes to match the column names the component
parses (`h.replace('_probability', '')` in DataDistributions.astro).

collection_stats_by_site.csv is a header transform only: the export names
columns `<metric>__<Site>` while the component expects `<site>__<metric>`.
"""
import argparse
import csv
import shutil
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "src" / "data" / "_aggregated"
OUT = ROOT / "src" / "data" / "cohort_ecdf"

# Cohort key -> directory holding that cohort's bins, and the suffix used by
# stats/collection_statistics*.csv. nippv_hfnc has bins in the export but no
# cohort in the registry, so it is deliberately not generated.
COHORTS = {
    "overall": ("overall/bins", ""),
    "icu": ("strata/icu/bins", "_icu"),
    "advanced_resp": ("strata/advanced_resp/bins", "_advanced_resp"),
    "vaso": ("strata/vaso/bins", "_vaso"),
    "deaths": ("strata/deaths/bins", "_deaths"),
}
CATEGORIES = ("labs", "respiratory_support", "vitals")

# The strata bins directories also hold each sub-cohort's variant of every
# parameter (albumin_g_dL_icu.parquet beside albumin_g_dL.parquet). The
# Distributions tab has no sub-cohort folders — it falls back to the parent —
# so those are skipped. Without this the parameter list gains phantom entries
# like "Albumin G DL Icu".
GROUP_SUFFIXES = ("_no_icu", "_ed_icu", "_ed_ward", "_icu")


def is_subcohort_variant(pq: Path) -> bool:
    """True when this file is a sub-cohort's copy of a parameter that also
    exists un-suffixed in the same directory."""
    for suffix in GROUP_SUFFIXES:
        if pq.stem.endswith(suffix):
            base = pq.with_name(pq.stem[: -len(suffix)] + pq.suffix)
            if base.exists():
                return True
    return False


def ecdf_from_bins(df: pd.DataFrame) -> tuple[list[str], list[list[str]]]:
    """Return (header, rows) for one parameter's ECDF CSV."""
    site_cols = [c for c in df.columns if c.startswith("count__") and c != "count__ALL"]
    sites = [c[len("count__"):] for c in site_cols]

    # Each site contributes probabilities at its own bin_max values.
    per_site: dict[str, dict[float, float]] = {}
    for col, site in zip(site_cols, sites):
        rows = df[df[col].notna()].sort_values("bin_max")
        total = rows[col].sum()
        if total <= 0:
            continue
        cumulative = rows[col].cumsum() / total
        per_site[site.lower()] = dict(zip(rows["bin_max"].astype(float), cumulative.astype(float)))

    if not per_site:
        return [], []

    values = sorted({v for points in per_site.values() for v in points})
    ordered_sites = sorted(per_site)
    header = ["value"] + [f"{s}_probability" for s in ordered_sites]
    out_rows = []
    for v in values:
        row = [f"{v:g}"]
        for s in ordered_sites:
            p = per_site[s].get(v)
            row.append("" if p is None else repr(float(p)))
        out_rows.append(row)
    return header, out_rows


def check_monotonic(header: list[str], rows: list[list[str]], label: str) -> list[str]:
    """An ECDF must be non-decreasing and end at 1. Report anything that isn't."""
    problems = []
    for i, col in enumerate(header[1:], start=1):
        seq = [float(r[i]) for r in rows if r[i]]
        if not seq:
            continue
        if any(b < a - 1e-9 for a, b in zip(seq, seq[1:])):
            problems.append(f"{label}:{col} not monotonic")
        if abs(seq[-1] - 1.0) > 1e-6:
            problems.append(f"{label}:{col} ends at {seq[-1]:.6f}, not 1")
    return problems


def transform_collection_stats(src: Path) -> str:
    """`<metric>__<Site>` -> `<site>__<metric>`, site code lowercased."""
    with src.open() as f:
        rows = list(csv.reader(f))
    header = rows[0]
    new_header = []
    for h in header:
        if "__" in h:
            metric, site = h.rsplit("__", 1)
            new_header.append(f"{site.lower()}__{metric}")
        else:
            new_header.append(h)
    out = [new_header] + rows[1:]
    buf = []
    for r in out:
        buf.append(",".join('"' + c.replace('"', '""') + '"' if any(ch in c for ch in ',"\n') else c for c in r))
    return "\n".join(buf) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    written = 0
    skipped = 0
    problems: list[str] = []

    for cohort, (bins_rel, stats_suffix) in COHORTS.items():
        bins_dir = RAW / bins_rel
        if not bins_dir.is_dir():
            print(f"MISSING BINS  {bins_rel}", file=sys.stderr)
            continue

        for category in CATEGORIES:
            src_dir = bins_dir / category
            if not src_dir.is_dir():
                continue
            dest_dir = OUT / cohort / category
            params = [pq for pq in sorted(src_dir.glob("*.parquet")) if not is_subcohort_variant(pq)]
            for pq in params:
                df = pd.read_parquet(pq)
                header, rows = ecdf_from_bins(df)
                if not rows:
                    skipped += 1
                    continue
                problems.extend(check_monotonic(header, rows, f"{cohort}/{category}/{pq.stem}"))
                text = ",".join(header) + "\n" + "\n".join(",".join(r) for r in rows) + "\n"
                dest = dest_dir / f"{pq.stem}.csv"
                if not args.dry_run:
                    dest_dir.mkdir(parents=True, exist_ok=True)
                    dest.write_text(text)
                written += 1
            variants = len(list(src_dir.glob("*.parquet"))) - len(params)
            note = f"  ({variants} sub-cohort variants skipped)" if variants else ""
            print(f"  {cohort}/{category}: {len(params)} parameters{note}")

        stats_src = RAW / "stats" / f"collection_statistics{stats_suffix}.csv"
        if stats_src.exists():
            if not args.dry_run:
                (OUT / cohort).mkdir(parents=True, exist_ok=True)
                (OUT / cohort / "collection_stats_by_site.csv").write_text(transform_collection_stats(stats_src))
            written += 1
        else:
            print(f"  MISSING STATS  {stats_src.name}", file=sys.stderr)

    print()
    print(f"{written} file(s) {'would be written' if args.dry_run else 'written'}, {skipped} skipped (no data)")
    if problems:
        print(f"\n{len(problems)} ECDF problem(s):", file=sys.stderr)
        for p in problems[:20]:
            print(f"  {p}", file=sys.stderr)
        return 1
    print("all ECDFs monotonic and terminate at 1.0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
