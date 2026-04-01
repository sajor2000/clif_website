# Secure Masking Tool — Overview

## What It Does

The Secure Masking tool lets CLIF consortium sites share **count data** (e.g., patient cohort counts by age, sex, location) without any single site exposing their raw numbers during the collection process. The final output is consortium-wide totals — no individual site's counts are ever visible to other sites or the server during aggregation.

## How It Works

1. **Project creator** defines the data dimensions (e.g., age group, sex, county) and selects participating sites
2. The system generates a **master key** — a random integer offset for every combination of dimension values — and splits it into N fragments (one per site), randomly assigned
3. Each site **downloads their unique fragment** and adds the offsets to their real counts locally:
   ```
   masked_count = real_count + fragment_offset
   ```
4. Sites deposit their **masked CSVs** in a shared location (e.g., Box). The project creator collects and sums them across all sites per cell
5. The creator **uploads the aggregated CSV** to the portal. The server reconstructs the master key from the stored fragments, subtracts it, and returns the true consortium-wide totals:
   ```
   true_total = sum(masked_counts) - master_key
   ```

## Security Properties

- **No raw data leaves any site.** Sites only share masked counts — random noise makes individual values meaningless in isolation
- **The server never sees real counts** until the final unmasking step, which produces only consortium-wide totals
- **Fragment assignment is blinded.** Which site gets which fragment is randomly shuffled using cryptographically secure randomness. The project creator does not control or see the mapping
- **Fragments are destroyed after unmasking.** All per-site offset data is permanently wiped from the database once unmasking completes
- **Dropped sites are handled gracefully.** If a site cannot participate, the creator marks them as dropped and the server automatically excludes their offsets during unmasking

## Privacy Considerations

| Sites | Individual Privacy |
|-------|-------------------|
| **2 sites** | Each site can compute the other's counts by subtracting their own from the consortium total. Works correctly, but both sites should be comfortable with this |
| **3+ sites** | No single site can isolate another site's counts from the total. Stronger privacy guarantees |

## Example

A project with dimensions **sex** (M, F) and **age_group** (18-44, 45-64, 65+) produces 6 cells. Each site receives a fragment like:

| sex | age_group | offset |
|-----|-----------|--------|
| M   | 18-44     | -142   |
| M   | 45-64     | 87     |
| F   | 18-44     | 203    |
| ...   | ...     | ...    |

The site adds these offsets to their real counts, uploads the masked CSV, and the creator aggregates all sites' masked data. The server subtracts the reconstructed master key to recover the true totals.

## Technical Details

- **Offsets**: Random integers in range [-500, 500], generated using `crypto.getRandomValues`
- **Fragment splitting**: Each cell's master offset is split into N random integers that sum exactly to the original
- **Data format**: Standard CSV with dimension columns + a count column
- **Audit trail**: The master key is stored after unmasking and can be downloaded by the project creator for record-keeping
