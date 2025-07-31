# Permissible-Values Automation

> Keep the `permissible` lists in every SQL DDL file **in sync** with the
> consortium CSVs – automatically, forever.

---

## 1. Why we did this

| Pain point | Solution |
|------------|----------|
| DDL comments listed category values manually & drifted from the true list in the CLIF repo | Generate the list straight from the source CSV each time. |
| Multiple tables (ADT, Hospitalization, Patient, etc.) each pull from their own CSV | One **config file** (`scripts/permissible-sources.js`) holds the mapping. |
| Developers kept forgetting to update the comment | A **GitHub Action** runs weekly and commits the change automatically. |
| Needed to cover future tables without new scripts | A **generic updater** (`scripts/update-permissibles.mjs`) works for any number of columns; just add new entries to the config array. |

---

## 2. Folder / file overview

```
clif_website/
├─ scripts/
│  ├─ permissible-sources.js      # mapping of columns → CSVs
│  └─ update-permissibles.mjs     # generic updater (Node + csv-parse)
├─ src/content/                   # *.sql DDL files (v-2-0-0, v-2-1-0, …)
├─ .github/workflows/ddl-sync.yml # weekly automation workflow
└─ package.json                   # npm scripts
```

### 2.1 `scripts/permissible-sources.js`

```js
export const SOURCES = [
  {
    // adt.location_category
    columnRegex: /("location_category"[^\n]+?"permissible"\s*:\s*")[^"]*(")/i,
    csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_adt_location_categories.csv',
    csvColumn: 'location_category',
  },
  {
    // hospitalization.discharge_category
    columnRegex: /("discharge_category"[^\n]+?"permissible"\s*:\s*")[^"]*(")/i,
    csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_hospitalization_discharge_categories.csv',
    csvColumn: 'discharge_category',
  },
  {
    // patient.race_category
    columnRegex: /("race_category"[^\n]+?"permissible"\s*:\s*")[^"]*(")/i,
    csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_patient_race_categories.csv',
    csvColumn: 'race_category',
  },
  {
    // position.position_category
    columnRegex: /("position_category"[^\n]+?"permissible"\s*:\s*")[^"]*(")/i,
    csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_position_categories.csv',
    csvColumn: 'position_category',
  },
  {
    // vitals.vital_category
    columnRegex: /("vital_category"[^\n]+?"permissible"\s*:\s*")[^"]*(")/i,
    csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_vital_categories.csv',
    csvColumn: 'vital_category',
  },
];
```

• **Add new columns** by pushing another object to the array – nothing else changes.

### 2.2 `scripts/update-permissibles.mjs`

* Fetches every `csv` URL in `SOURCES`.
* Extracts the specified `csvColumn`.
* Creates a sorted, de-duplicated list.
* Rewrites all DDL files passed on the command line, replacing the `permissible` value inside the JSON comment.

### 2.3 `package.json` script

```jsonc
"scripts": {
  …,
  "ddl:update": "node scripts/update-permissibles.mjs src/content/v-2-0-0-ddl.sql src/content/v-2-1-0-ddl.sql"
}
```

Add more file paths as new versions appear.

### 2.4 GitHub Action (`.github/workflows/ddl-sync.yml`)

* Runs **every Sunday 03:00 UTC** (cron `0 3 * * 0`) and on manual dispatch.
* Steps:
  1. Checkout the repo.
  2. Set up Node 20 & restore npm cache.
  3. `npm ci` → installs `csv-parse` and the updater.
  4. `npm run ddl:update`.
  5. If `git diff` is not empty → commits and pushes `chore: refresh …`.

Public repos: free minutes. Private repos: ~30 s / week ≈ **2 runner-minutes / month**.

---

## 3. Day-to-day usage

### 3.1 Developer workflow

| Want up-to-date DDL **right now** | OK waiting until Sunday |
|----------------------------------|-------------------------|
| Run `npm run ddl:update`, commit & push. | Do nothing – the bot will update and push. |

### 3.2 Adding another column

1. Append config in `permissible-sources.js`.
2. Add its CSV column name.
3. (Optionally) include the new DDL file in the npm script.
4. Commit – done.

### 3.3 Local dev convenience (optional)

If you want the updater to run before the Astro dev server:

```jsonc
"scripts": {
  "dev": "npm run ddl:update && astro dev",
  …
}
```

Or add a Husky *pre-commit* hook:

```sh
# .husky/pre-commit
npm run ddl:update
```

---

## 4. Troubleshooting

| Symptom | Fix |
|---------|------|
| `npm run ddl:update` throws *csv-parse not found* | `npm i -D csv-parse` |
| GitHub Action fails with 403 on push | Branch protections? Switch workflow to create PR instead of push. |
| A permissible list still out-of-date | Ensure correct `columnRegex` and `csvColumn` in `permissible-sources.js`, then run the updater. |

---

## 5. Credits

Automation pattern inspired by [CSV-driven DDL updates](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF) and tailored for CLIF consortium needs.
