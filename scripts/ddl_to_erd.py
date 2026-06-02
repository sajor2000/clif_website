#!/usr/bin/env python3
"""
ddl_to_erd.py — regenerate the interactive CLIF 3.0.0 ERD from the DDL.

The SQL schema in src/content/v-3-0-0-ddl.sql is the single source of truth.
This script parses it, derives the TABLES / REFS data arrays, and injects them
into scripts/erd_template.html, writing the self-contained, served artifact at
public/images/data-dictionary/clif_erd_3.0.0.html.

The diagram is NEVER hand-edited: edit the DDL, then run `npm run erd`
(or `python3 scripts/ddl_to_erd.py`) and commit the regenerated HTML.

What comes from the DDL (structural, always current):
  - tables, columns, column types
  - relationships: explicit FOREIGN KEY constraints + conventional *_id links
  - pk / fk key markers (derived from the relationships below)

What is human-curated here (NOT expressible in SQL DDL):
  - DOMAIN_MAP / DOMAIN_ORDER ... clinical-domain grouping of tables
  - MATURITY_MAP ............... Beta vs Concept status
  - KEY_TO_TABLE ............... which shared *_id column points to which parent
  - PRIMARY_KEYS .............. each entity table's primary-key column
A table missing from the curated maps still renders (defaults: concept / "Other"
group, appended last) — add a one-line entry to categorize it.
"""

from __future__ import annotations
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DDL = ROOT / "src" / "content" / "v-3-0-0-ddl.sql"
TEMPLATE = ROOT / "scripts" / "erd_template.html"
OUT = ROOT / "public" / "images" / "data-dictionary" / "clif_erd_3.0.0.html"

EXPECTED_TABLE_COUNT = 41

# --------------------------------------------------------------------------- #
# Curated config — the only non-DDL inputs.
# --------------------------------------------------------------------------- #

# Shared *_id column -> the parent table it references. Drives both the
# conventional relationships and the fk markers. Any table carrying one of these
# columns auto-links to its parent, so new tables need no extra wiring.
KEY_TO_TABLE = {
    "patient_id": "patient",
    "hospitalization_id": "hospitalization",
    "med_order_id": "medication_orders",
    "model_id": "model_registry",
    "organism_id": "microbiology_culture",
    "note_id": "clinical_notes_facts",
}

# Entity tables and their primary-key column (marked ◆). Event/leaf tables that
# carry an *_id without being referenced as a parent are intentionally omitted.
PRIMARY_KEYS = {
    "patient": "patient_id",
    "hospitalization": "hospitalization_id",
    "microbiology_culture": "organism_id",
    "medication_orders": "med_order_id",
    "airway": "airway_id",
    "drain": "drain_id",
    "line": "line_id",
    "clinical_notes_facts": "note_id",
    "radiology": "radiology_accession",
    "model_registry": "model_id",
}

# Clinical-domain grouping (column layout, left -> right) and maturity.
# (table, maturity) listed in display order within each domain.
DOMAINS = [
    ("Patient & Encounter", [
        ("patient", "beta"), ("hospitalization", "beta"), ("adt", "beta"),
        ("ed_encounter", "concept"), ("provider", "concept"),
        ("place_based_index", "concept"), ("patient_attributes", "concept"),
    ]),
    ("Diagnoses & Code Status", [
        ("hospital_diagnosis", "beta"), ("patient_diagnosis", "concept"),
        ("validated_diagnosis", "concept"), ("code_status", "beta"),
    ]),
    ("Labs & Microbiology", [
        ("labs", "beta"), ("microbiology_culture", "beta"),
        ("microbiology_susceptibility", "beta"), ("microbiology_nonculture", "concept"),
    ]),
    ("Medications", [
        ("medication_orders", "concept"), ("medication_admin_continuous", "beta"),
        ("medication_admin_intermittent", "beta"),
    ]),
    ("Respiratory & Monitoring", [
        ("vitals", "beta"), ("respiratory_support", "beta"),
        ("patient_assessments", "beta"), ("position", "beta"),
        ("invasive_hemodynamics", "concept"),
    ]),
    ("Devices & Support", [
        ("airway", "concept"), ("drain", "concept"), ("line", "concept"),
        ("mcs", "concept"), ("crrt_therapy", "beta"), ("intermittent_dialysis", "concept"),
    ]),
    ("Fluids & Blood", [
        ("input", "concept"), ("output", "concept"), ("transfusion", "concept"),
    ]),
    ("Procedures, Orders & Therapy", [
        ("patient_procedures", "beta"), ("key_icu_orders", "concept"),
        ("therapy_details", "concept"),
    ]),
    ("Trials, Notes, Imaging & Scores", [
        ("clinical_trial", "concept"), ("clinical_notes_facts", "concept"),
        ("clinical_notes_text", "concept"), ("radiology", "concept"),
        ("model_registry", "concept"), ("scores", "concept"),
    ]),
]

DOMAIN_ORDER = [name for name, _ in DOMAINS]
TABLE_ORDER = [t for _, tbls in DOMAINS for t, _ in tbls]
DOMAIN_MAP = {t: name for name, tbls in DOMAINS for t, _ in tbls}
MATURITY_MAP = {t: m for _, tbls in DOMAINS for t, m in tbls}

DEFAULT_DOMAIN = "Other"
DEFAULT_MATURITY = "concept"

# --------------------------------------------------------------------------- #
# DDL parsing
# --------------------------------------------------------------------------- #

_CREATE_RE = re.compile(r"\s*CREATE TABLE\s+(\w+)\s*\(", re.IGNORECASE)
_END_RE = re.compile(r"\s*\)\s*;")
_COL_RE = re.compile(r"(\w+)\s+([A-Za-z][A-Za-z0-9_]*)")
_FK_RE = re.compile(
    r"FOREIGN KEY\s*\(\s*(\w+)\s*\)\s*REFERENCES\s+(\w+)", re.IGNORECASE
)
_SKIP_RE = re.compile(r"(PRIMARY KEY|CONSTRAINT|UNIQUE|CHECK)\b", re.IGNORECASE)


def parse_ddl(text: str):
    """Return {table: {"cols": [(name, type)], "fks": [(child_col, parent_table)]}}."""
    tables: dict[str, dict] = {}
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        m = _CREATE_RE.match(lines[i])
        if not m:
            i += 1
            continue
        name = m.group(1)
        cols: list[tuple[str, str]] = []
        fks: list[tuple[str, str]] = []
        i += 1
        while i < len(lines) and not _END_RE.match(lines[i]):
            line = lines[i].strip().rstrip(",").strip()
            if not line:
                i += 1
                continue
            fk = _FK_RE.match(line)
            if fk:
                fks.append((fk.group(1), fk.group(2)))
            elif _SKIP_RE.match(line):
                pass
            else:
                cm = _COL_RE.match(line)
                if cm:
                    cols.append((cm.group(1), cm.group(2).lower()))
            i += 1
        tables[name] = {"cols": cols, "fks": fks}
        i += 1
    return tables


# --------------------------------------------------------------------------- #
# Derivation
# --------------------------------------------------------------------------- #

def build_refs(tables: dict[str, dict]) -> list[list[str]]:
    """Union of explicit FK constraints and conventional KEY_TO_TABLE links."""
    refs: set[tuple[str, str]] = set()
    for name, info in tables.items():
        # explicit FOREIGN KEY ... REFERENCES
        for _child_col, parent in info["fks"]:
            if parent in tables and parent != name:
                refs.add((name, parent))
        # conventional shared *_id columns
        for col, _type in info["cols"]:
            parent = KEY_TO_TABLE.get(col)
            if parent and parent != name and parent in tables:
                refs.add((name, parent))
    # deterministic order: by table display order, then parent
    order = {t: idx for idx, t in enumerate(TABLE_ORDER)}
    return [
        [a, b]
        for a, b in sorted(
            refs, key=lambda r: (order.get(r[0], 999), order.get(r[1], 999), r[1])
        )
    ]


def col_key(table: str, col: str, fk_cols: set[str]) -> str:
    """'pk' | 'fk' | '' for the ◆/◇ marker."""
    if PRIMARY_KEYS.get(table) == col:
        return "pk"
    if col in fk_cols:
        return "fk"
    return ""


def build_tables(tables: dict[str, dict]) -> list[dict]:
    out = []
    ordered = TABLE_ORDER + [t for t in tables if t not in DOMAIN_MAP]
    for name in ordered:
        if name not in tables:
            print(f"  ! curated table '{name}' missing from DDL", file=sys.stderr)
            continue
        info = tables[name]
        explicit_fk_cols = {c for c, _ in info["fks"]}
        fk_cols = explicit_fk_cols | {
            col for col, _ in info["cols"]
            if col in KEY_TO_TABLE and KEY_TO_TABLE[col] != name
        }
        cols = []
        for col, ctype in info["cols"]:
            key = col_key(name, col, fk_cols)
            cols.append([col, ctype, key] if key else [col, ctype])
        out.append({
            "n": name,
            "m": MATURITY_MAP.get(name, DEFAULT_MATURITY),
            "g": DOMAIN_MAP.get(name, DEFAULT_DOMAIN),
            "cols": cols,
        })
    return out


# --------------------------------------------------------------------------- #
# Render
# --------------------------------------------------------------------------- #

def render():
    ddl_text = DDL.read_text(encoding="utf-8")
    template = TEMPLATE.read_text(encoding="utf-8")

    tables = parse_ddl(ddl_text)
    table_list = build_tables(tables)
    refs = build_refs(tables)
    domain_order = DOMAIN_ORDER + (
        [DEFAULT_DOMAIN] if any(t["g"] == DEFAULT_DOMAIN for t in table_list) else []
    )

    beta = sum(1 for t in table_list if t["m"] == "beta")
    concept = sum(1 for t in table_list if t["m"] == "concept")

    html = (
        template
        .replace("__TABLES__", json.dumps(table_list, indent=1))
        .replace("__REFS__", json.dumps(refs))
        .replace("__DOMAIN_ORDER__", json.dumps(domain_order))
        .replace("__BETA_COUNT__", str(beta))
        .replace("__CONCEPT_COUNT__", str(concept))
    )

    if "__" in html and re.search(r"__[A-Z_]+__", html):
        leftover = set(re.findall(r"__[A-Z_]+__", html))
        sys.exit(f"ERROR: unfilled template markers remain: {sorted(leftover)}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")

    print(f"Parsed {len(tables)} tables from {DDL.relative_to(ROOT)}")
    print(f"  -> {len(table_list)} tables emitted ({beta} beta, {concept} concept)")
    print(f"  -> {len(refs)} relationships")
    print(f"  -> wrote {OUT.relative_to(ROOT)}")

    if len(table_list) != EXPECTED_TABLE_COUNT:
        sys.exit(
            f"ERROR: expected {EXPECTED_TABLE_COUNT} tables, emitted {len(table_list)}"
        )


if __name__ == "__main__":
    render()
