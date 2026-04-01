# Secure Masking Tool

## What It Does

Lets CLIF consortium sites share count data (e.g., patient counts by age, sex, county) without exposing any individual site's raw numbers. The output is consortium-wide totals only.

## How It Works

1. A project creator defines the data dimensions and selects participating sites
2. The system generates random offsets and splits them into fragments -- one per site, randomly assigned
3. Each site downloads their fragment and masks their data locally: `masked_count = real_count + offset`
4. Sites deposit masked CSVs in Box. The creator collects and sums them into one aggregated CSV
5. The creator either uploads the aggregated CSV for server-side unmasking, or finalizes the project to download the master key and unmask locally

## Key Details

**Site management.** All sites are included by default when you create a project. It's easier to drop a site later than to regenerate keys and redo the masking. When a site is dropped, the tool automatically excludes their offsets during unmasking -- no manual adjustment needed.

**Site access.** All members listed for a given site have access to that site's key fragment. You can control who has access by choosing which members to include when setting up sites.

**Data storage.** The site-specific key fragments are stored in the backend database (which only the project administrator has access to). When the project is finalized or unmasked, all fragment data is permanently wiped. The master key is stored as an audit record and can be downloaded by the project creator and any same-site members they authorize.

**One-time operation.** Unmasking can only happen once per project. After it's done, all keys are destroyed and the project is final. The only things stored permanently are the aggregated data, the unmasked result, and the master key (for audit purposes). If something needs to change, create a new project.

**Privacy with 2 sites.** The tool works with as few as 2 sites, but note that each site can compute the other's real counts by subtracting their own from the consortium total. With 3 or more sites, no single site can isolate another's data.
