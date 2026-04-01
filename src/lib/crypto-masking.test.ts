import { describe, it, expect } from 'vitest';
import {
  generateCellKeys,
  generateMasterKey,
  splitMasterKey,
  unmaskAggregated,
  computeMasterKeyFromFragments,
  unmaskServerSide,
  keyDataToCsv,
  parseMaskedCsv,
  parseCellKey,
  fragmentLabel,
  type StrataDimension,
} from './crypto-masking';

const testDimensions: StrataDimension[] = [
  { name: 'county', categories: ['01001', '01003', '06037'] },
  { name: 'year', categories: ['2020', '2021', '2022'] },
  { name: 'sex', categories: ['M', 'F'] },
];

describe('generateCellKeys', () => {
  it('produces correct number of keys', () => {
    const keys = generateCellKeys(testDimensions);
    // 3 counties x 3 years x 2 sex = 18
    expect(keys.length).toBe(18);
  });

  it('keys have correct format', () => {
    const keys = generateCellKeys(testDimensions);
    expect(keys).toContain('01001_2020_M');
    expect(keys).toContain('06037_2022_F');
  });

  it('handles single dimension', () => {
    const dims: StrataDimension[] = [{ name: 'sex', categories: ['M', 'F'] }];
    const keys = generateCellKeys(dims);
    expect(keys).toEqual(['M', 'F']);
  });

  it('handles many dimensions', () => {
    const dims: StrataDimension[] = [
      { name: 'a', categories: ['1', '2'] },
      { name: 'b', categories: ['x', 'y'] },
      { name: 'c', categories: ['p', 'q', 'r'] },
    ];
    const keys = generateCellKeys(dims);
    expect(keys.length).toBe(2 * 2 * 3);
    expect(keys).toContain('1_x_p');
    expect(keys).toContain('2_y_r');
  });
});

describe('generateMasterKey', () => {
  it('produces offsets for every cell key', () => {
    const cellKeys = generateCellKeys(testDimensions);
    const master = generateMasterKey(cellKeys);
    expect(Object.keys(master).length).toBe(cellKeys.length);
    for (const key of cellKeys) {
      expect(master).toHaveProperty(key);
      expect(typeof master[key]).toBe('number');
    }
  });

  it('default offsets are within [11, 40]', () => {
    const cellKeys = generateCellKeys(testDimensions);
    const master = generateMasterKey(cellKeys);
    for (const val of Object.values(master)) {
      expect(val).toBeGreaterThanOrEqual(11);
      expect(val).toBeLessThanOrEqual(40);
    }
  });

  it('offsets are within custom range', () => {
    const cellKeys = generateCellKeys(testDimensions);
    const master = generateMasterKey(cellKeys, -100, 100);
    for (const val of Object.values(master)) {
      expect(val).toBeGreaterThanOrEqual(-100);
      expect(val).toBeLessThanOrEqual(100);
    }
  });
});

describe('splitMasterKey', () => {
  it('fragments sum to master key for every cell', () => {
    const cellKeys = generateCellKeys(testDimensions);
    const master = generateMasterKey(cellKeys);
    const fragments = splitMasterKey(master, 5);

    expect(fragments.length).toBe(5);

    for (const key of cellKeys) {
      const fragmentSum = fragments.reduce((sum, frag) => sum + frag[key], 0);
      expect(fragmentSum).toBe(master[key]);
    }
  });

  it('works with 2 sites', () => {
    const master: Record<string, number> = { a: 100, b: -50, c: 0 };
    const fragments = splitMasterKey(master, 2);

    expect(fragments.length).toBe(2);
    expect(fragments[0]['a'] + fragments[1]['a']).toBe(100);
    expect(fragments[0]['b'] + fragments[1]['b']).toBe(-50);
    expect(fragments[0]['c'] + fragments[1]['c']).toBe(0);
  });

  it('works with 10 sites', () => {
    const cellKeys = generateCellKeys(testDimensions);
    const master = generateMasterKey(cellKeys);
    const fragments = splitMasterKey(master, 10);

    expect(fragments.length).toBe(10);

    for (const key of cellKeys) {
      const fragmentSum = fragments.reduce((sum, frag) => sum + frag[key], 0);
      expect(fragmentSum).toBe(master[key]);
    }
  });
});

describe('full round-trip: generate → split → mask → aggregate → unmask', () => {
  it('recovers true counts exactly', () => {
    const cellKeys = generateCellKeys(testDimensions);
    const master = generateMasterKey(cellKeys);
    const fragments = splitMasterKey(master, 4);

    // Simulate real counts per site
    const siteCounts = fragments.map(() => {
      const counts: Record<string, number> = {};
      for (const key of cellKeys) {
        counts[key] = Math.floor(Math.random() * 200) + 20;
      }
      return counts;
    });

    // Each site masks: masked = real + offset
    const maskedPerSite = fragments.map((frag, i) => {
      const masked: Record<string, number> = {};
      for (const key of cellKeys) {
        masked[key] = siteCounts[i][key] + frag[key];
      }
      return masked;
    });

    // Aggregate: sum all masked values per cell
    const aggregated: Record<string, number> = {};
    for (const key of cellKeys) {
      aggregated[key] = maskedPerSite.reduce((sum, m) => sum + m[key], 0);
    }

    // Unmask
    const { result, warnings } = unmaskAggregated(aggregated, master);

    // Verify: result should equal sum of all sites' real counts
    for (const key of cellKeys) {
      const trueTotal = siteCounts.reduce((sum, sc) => sum + sc[key], 0);
      expect(result[key]).toBe(trueTotal);
    }
    expect(warnings.length).toBe(0);
  });
});

describe('parseCellKey', () => {
  it('parses correctly', () => {
    const dims: StrataDimension[] = [
      { name: 'county', categories: ['01001'] },
      { name: 'year', categories: ['2020'] },
      { name: 'sex', categories: ['M'] },
    ];
    const result = parseCellKey('01001_2020_M', dims);
    expect(result).toEqual({ county: '01001', year: '2020', sex: 'M' });
  });

  it('returns null for wrong number of parts', () => {
    const dims: StrataDimension[] = [
      { name: 'a', categories: ['1'] },
      { name: 'b', categories: ['2'] },
    ];
    expect(parseCellKey('only_one_two_three', dims)).toBeNull();
    expect(parseCellKey('one', dims)).toBeNull();
  });
});

describe('keyDataToCsv / parseMaskedCsv round-trip', () => {
  it('CSV export and re-import preserves data', () => {
    const dims: StrataDimension[] = [
      { name: 'region', categories: ['A', 'B'] },
      { name: 'year', categories: ['2020', '2021'] },
    ];
    const cellKeys = generateCellKeys(dims);
    const master = generateMasterKey(cellKeys, -50, 50);

    const csv = keyDataToCsv(master, dims);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('region,year,offset');
    expect(lines.length).toBe(cellKeys.length + 1);

    const { data, errors } = parseMaskedCsv(csv, dims);
    expect(errors.length).toBe(0);
    expect(Object.keys(data).length).toBe(cellKeys.length);

    for (const key of cellKeys) {
      expect(data[key]).toBe(master[key]);
    }
  });
});

describe('computeMasterKeyFromFragments', () => {
  it('round-trips with splitMasterKey', () => {
    const cellKeys = generateCellKeys(testDimensions);
    const master = generateMasterKey(cellKeys);
    const fragments = splitMasterKey(master, 5);

    const reconstructed = computeMasterKeyFromFragments(fragments);

    for (const key of cellKeys) {
      expect(reconstructed[key]).toBe(master[key]);
    }
  });

  it('handles empty array', () => {
    const result = computeMasterKeyFromFragments([]);
    expect(result).toEqual({});
  });

  it('handles single fragment', () => {
    const fragment = { a: 10, b: -20 };
    const result = computeMasterKeyFromFragments([fragment]);
    expect(result).toEqual({ a: 10, b: -20 });
  });
});

describe('unmaskServerSide', () => {
  it('recovers true counts with all sites active', () => {
    const cellKeys = generateCellKeys(testDimensions);
    const master = generateMasterKey(cellKeys);
    const fragments = splitMasterKey(master, 4);

    const siteCounts = fragments.map(() => {
      const counts: Record<string, number> = {};
      for (const key of cellKeys) {
        counts[key] = Math.floor(Math.random() * 200) + 20;
      }
      return counts;
    });

    const aggregated: Record<string, number> = {};
    for (const key of cellKeys) {
      aggregated[key] = fragments.reduce(
        (sum, frag, i) => sum + siteCounts[i][key] + frag[key],
        0,
      );
    }

    const { result, warnings } = unmaskServerSide(aggregated, fragments, []);

    for (const key of cellKeys) {
      const trueTotal = siteCounts.reduce((sum, sc) => sum + sc[key], 0);
      expect(result[key]).toBe(trueTotal);
    }
    expect(warnings.length).toBe(0);
  });

  it('recovers true counts with dropped sites', () => {
    const cellKeys = generateCellKeys(testDimensions);
    const master = generateMasterKey(cellKeys);
    const fragments = splitMasterKey(master, 4);
    const droppedIndices = [1, 3]; // drop sites at index 1 and 3
    const activeIndices = [0, 2];

    const siteCounts = fragments.map(() => {
      const counts: Record<string, number> = {};
      for (const key of cellKeys) {
        counts[key] = Math.floor(Math.random() * 100) + 15;
      }
      return counts;
    });

    // Only active sites contribute to the aggregated data
    const aggregated: Record<string, number> = {};
    for (const key of cellKeys) {
      aggregated[key] = activeIndices.reduce(
        (sum, i) => sum + siteCounts[i][key] + fragments[i][key],
        0,
      );
    }

    const { result } = unmaskServerSide(aggregated, fragments, droppedIndices);

    for (const key of cellKeys) {
      const trueTotal = activeIndices.reduce((sum, i) => sum + siteCounts[i][key], 0);
      expect(result[key]).toBe(trueTotal);
    }
  });
});

describe('fragmentLabel', () => {
  it('generates correct labels', () => {
    expect(fragmentLabel(0)).toBe('Fragment A');
    expect(fragmentLabel(1)).toBe('Fragment B');
    expect(fragmentLabel(25)).toBe('Fragment Z');
    expect(fragmentLabel(26)).toBe('Fragment AA');
  });
});
