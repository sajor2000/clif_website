/**
 * Deterministic Additive Masking — Core Cryptographic Functions
 *
 * Implements key generation, splitting, and unmasking for federated
 * count data aggregation. Fully generic — the scaffold is defined
 * entirely by user-configured dimensions (no hardcoded geography or time).
 */

export interface StrataDimension {
  name: string;
  categories: string[];
}

/**
 * Generate all cell key strings from the cartesian product of all dimensions.
 * Each cell key is: {dim1-val}_{dim2-val}_{dim3-val}_...
 */
export function generateCellKeys(strataConfig: StrataDimension[]): string[] {
  if (strataConfig.length === 0) return [];
  const combinations = cartesianProduct(strataConfig.map((d) => d.categories));
  return combinations.map((combo) => combo.join('_'));
}

/**
 * Cartesian product of arrays.
 * cartesianProduct([["M","F"], ["18-44","45-64"]]) =>
 *   [["M","18-44"], ["M","45-64"], ["F","18-44"], ["F","45-64"]]
 */
function cartesianProduct(arrays: string[][]): string[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<string[][]>(
    (acc, arr) => acc.flatMap((combo) => arr.map((item) => [...combo, item])),
    [[]],
  );
}

/**
 * Generate a master key with a random integer offset for each cell.
 * Offsets are in range [minOffset, maxOffset] (default [11, 40]).
 */
export function generateMasterKey(
  cellKeys: string[],
  minOffset = 11,
  maxOffset = 40,
): Record<string, number> {
  const range = maxOffset - minOffset + 1;
  const masterKey: Record<string, number> = {};

  const batchSize = 4096;
  let randomPool = new Int32Array(0);
  let poolIndex = 0;

  function nextRandom(): number {
    if (poolIndex >= randomPool.length) {
      randomPool = new Int32Array(batchSize);
      crypto.getRandomValues(randomPool);
      poolIndex = 0;
    }
    const raw = randomPool[poolIndex++];
    return minOffset + (((raw % range) + range) % range);
  }

  for (const key of cellKeys) {
    masterKey[key] = nextRandom();
  }

  return masterKey;
}

/**
 * Split a master key into N site key fragments.
 * For each cell, generates N random integers that sum to the master offset.
 */
export function splitMasterKey(
  masterKey: Record<string, number>,
  numSites: number,
): Record<string, number>[] {
  const fragments: Record<string, number>[] = Array.from({ length: numSites }, () => ({}));
  const cellKeys = Object.keys(masterKey);

  const fragmentRange = 400;
  const batchSize = 4096;
  let randomPool = new Int32Array(0);
  let poolIndex = 0;

  function nextRandom(): number {
    if (poolIndex >= randomPool.length) {
      randomPool = new Int32Array(batchSize);
      crypto.getRandomValues(randomPool);
      poolIndex = 0;
    }
    const raw = randomPool[poolIndex++];
    return -200 + (((raw % (fragmentRange + 1)) + (fragmentRange + 1)) % (fragmentRange + 1));
  }

  for (const key of cellKeys) {
    const masterOffset = masterKey[key];
    let remaining = masterOffset;

    for (let i = 0; i < numSites - 1; i++) {
      const val = nextRandom();
      fragments[i][key] = val;
      remaining -= val;
    }
    fragments[numSites - 1][key] = remaining;
  }

  return fragments;
}

/**
 * Compute an adjusted master key that excludes dropped site fragments.
 */
export function computeAdjustedMasterKey(
  originalMasterKey: Record<string, number>,
  droppedFragments: Record<string, number>[],
): Record<string, number> {
  if (droppedFragments.length === 0) return originalMasterKey;

  const adjusted: Record<string, number> = {};
  for (const key of Object.keys(originalMasterKey)) {
    let droppedSum = 0;
    for (const fragment of droppedFragments) {
      droppedSum += fragment[key] || 0;
    }
    adjusted[key] = originalMasterKey[key] - droppedSum;
  }
  return adjusted;
}

/**
 * Unmask aggregated data by subtracting the master key offsets.
 */
export function unmaskAggregated(
  aggregatedMasked: Record<string, number>,
  masterKey: Record<string, number>,
): { result: Record<string, number>; warnings: string[] } {
  const result: Record<string, number> = {};
  const warnings: string[] = [];

  for (const key of Object.keys(masterKey)) {
    if (!(key in aggregatedMasked)) {
      warnings.push(`Missing cell in aggregated data: ${key}`);
      continue;
    }
    const trueCount = aggregatedMasked[key] - masterKey[key];
    if (trueCount < 0) {
      warnings.push(`Negative count for cell ${key}: ${trueCount}`);
    }
    result[key] = trueCount;
  }

  for (const key of Object.keys(aggregatedMasked)) {
    if (!(key in masterKey)) {
      warnings.push(`Unexpected cell in aggregated data: ${key}`);
    }
  }

  return { result, warnings };
}

/**
 * Parse a cell key back into its dimension values.
 */
export function parseCellKey(
  cellKey: string,
  strataConfig: StrataDimension[],
): Record<string, string> | null {
  const parts = cellKey.split('_');
  if (parts.length !== strataConfig.length) return null;

  const result: Record<string, string> = {};
  for (let i = 0; i < strataConfig.length; i++) {
    result[strataConfig[i].name] = parts[i];
  }
  return result;
}

/**
 * Convert key data to CSV string.
 * CSV columns: [dimension names...], offset
 */
export function keyDataToCsv(
  keyData: Record<string, number>,
  strataConfig: StrataDimension[],
): string {
  const dimNames = strataConfig.map((d) => d.name);
  const header = [...dimNames, 'offset'].join(',');
  const rows: string[] = [header];

  for (const [cellKey, offset] of Object.entries(keyData)) {
    const parsed = parseCellKey(cellKey, strataConfig);
    if (!parsed) continue;
    const values = dimNames.map((name) => parsed[name] || '');
    rows.push([...values, offset].join(','));
  }

  return rows.join('\n');
}

/**
 * Convert unmasked result data to CSV.
 * CSV columns: [dimension names...], count
 */
export function resultToCsv(
  resultData: Record<string, number>,
  strataConfig: StrataDimension[],
): string {
  const dimNames = strataConfig.map((d) => d.name);
  const header = [...dimNames, 'count'].join(',');
  const rows: string[] = [header];

  for (const [cellKey, count] of Object.entries(resultData)) {
    const parsed = parseCellKey(cellKey, strataConfig);
    if (!parsed) continue;
    const values = dimNames.map((name) => parsed[name] || '');
    rows.push([...values, count].join(','));
  }

  return rows.join('\n');
}

/**
 * Parse a CSV string (masked data upload) into a cell key → value map.
 * Expected format: [dimension columns...], masked_count
 */
export function parseMaskedCsv(
  csvText: string,
  strataConfig: StrataDimension[],
): { data: Record<string, number>; errors: string[] } {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return { data: {}, errors: ['CSV must have a header row and at least one data row'] };
  }

  const data: Record<string, number> = {};
  const errors: string[] = [];
  const expectedCols = strataConfig.length + 1;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length !== expectedCols) {
      errors.push(`Row ${i + 1}: expected ${expectedCols} columns, got ${cols.length}`);
      continue;
    }

    const dimValues = cols.slice(0, strataConfig.length);
    const maskedCount = parseInt(cols[cols.length - 1], 10);

    if (isNaN(maskedCount)) {
      errors.push(`Row ${i + 1}: invalid count value "${cols[cols.length - 1]}"`);
      continue;
    }

    const cellKey = dimValues.join('_');
    data[cellKey] = maskedCount;
  }

  return { data, errors };
}

/**
 * Reconstruct the master key by summing all fragment offset records.
 * This is the mathematical inverse of splitMasterKey:
 *   computeMasterKeyFromFragments(splitMasterKey(master, N)) === master
 */
export function computeMasterKeyFromFragments(
  fragments: Record<string, number>[],
): Record<string, number> {
  const masterKey: Record<string, number> = {};
  for (const fragment of fragments) {
    for (const [key, val] of Object.entries(fragment)) {
      masterKey[key] = (masterKey[key] || 0) + val;
    }
  }
  return masterKey;
}

/**
 * Server-side unmasking: given aggregated masked data and all fragment records,
 * computes the true counts by summing only active (non-dropped) fragments
 * and subtracting from the aggregated data.
 */
export function unmaskServerSide(
  aggregatedMasked: Record<string, number>,
  allFragments: Record<string, number>[],
  droppedIndices: number[],
): { result: Record<string, number>; warnings: string[] } {
  const droppedSet = new Set(droppedIndices);
  const activeFragments = allFragments.filter((_, i) => !droppedSet.has(i));
  const adjustedMaster = computeMasterKeyFromFragments(activeFragments);
  return unmaskAggregated(aggregatedMasked, adjustedMaster);
}

/**
 * Generate alphabet-based labels for key fragments.
 */
export function fragmentLabel(index: number): string {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return `Fragment ${label}`;
}
