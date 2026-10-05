import { describe, it, expect } from 'vitest';
import { trigrams, similarity, clusterLeaves, leavesOf, topClades, rankMatches } from './mappingWheel';

const leaf = (label: string, weight = 1) => ({ id: label, label, weight });

describe('trigram similarity', () => {
  it('is 1 for the same string regardless of case and punctuation', () => {
    expect(similarity(trigrams('Nasal Cannula'), trigrams('nasal-cannula'))).toBe(1);
  });
  it('is higher for strings that share more', () => {
    const a = trigrams('propofol 10 mg/ml');
    expect(similarity(a, trigrams('propofol 20 mg/ml'))).toBeGreaterThan(similarity(a, trigrams('norepinephrine')));
  });
  it('is 0 with nothing shared', () => {
    expect(similarity(trigrams('abc'), trigrams('xyz'))).toBe(0);
  });
});

describe('clustering', () => {
  it('puts look-alike strings next to each other on the rim', () => {
    const root = clusterLeaves([
      leaf('propofol 10 mg/ml'),
      leaf('norepinephrine 4 mg'),
      leaf('propofol 20 mg/ml'),
      leaf('norepinephrine 8 mg'),
      leaf('insulin regular'),
    ]);
    const order = leavesOf(root).map((l) => l.label);
    const idx = (s: string) => order.indexOf(s);
    expect(Math.abs(idx('propofol 10 mg/ml') - idx('propofol 20 mg/ml'))).toBe(1);
    expect(Math.abs(idx('norepinephrine 4 mg') - idx('norepinephrine 8 mg'))).toBe(1);
    expect(leavesOf(root)).toHaveLength(5);
  });

  it('handles the empty and single-leaf cases', () => {
    expect(leavesOf(clusterLeaves([]))).toEqual([]);
    expect(clusterLeaves([leaf('x')]).leaf?.label).toBe('x');
  });

  it('merge heights grow toward the root', () => {
    const root = clusterLeaves([leaf('aaa'), leaf('aab'), leaf('zzz')]);
    expect(root.height).toBeGreaterThanOrEqual(Math.max(...root.children!.map((c) => c.height)));
  });
});

describe('top clades', () => {
  it('splits the tree into k families in rim order', () => {
    const root = clusterLeaves([leaf('propofol a'), leaf('propofol b'), leaf('insulin a'), leaf('insulin b')]);
    const clades = topClades(root, 2);
    expect(clades).toHaveLength(2);
    expect(clades.flat().map((l) => l.label)).toEqual(leavesOf(root).map((l) => l.label));
  });
  it('never asks for more clades than leaves', () => {
    expect(topClades(clusterLeaves([leaf('a'), leaf('b')]), 5)).toHaveLength(2);
  });
});

describe('search ranking', () => {
  const leaves = [leaf('PROPOFOL 10 MG/ML', 5), leaf('propofol', 50), leaf('Propofol Infusion', 20), leaf('norepinephrine', 90)];
  it('puts the exact post-norm match first, then the closest', () => {
    const m = rankMatches('propofol', leaves, 3);
    expect(m[0].leaf.label).toBe('propofol');
    expect(m[0].exact).toBe(true);
    expect(m.map((x) => x.leaf.label)).not.toContain('norepinephrine');
  });
  it('treats a substring hit as a strong match', () => {
    const m = rankMatches('infusion', leaves, 1);
    expect(m[0].leaf.label).toBe('Propofol Infusion');
    expect(m[0].score).toBeGreaterThanOrEqual(0.6);
  });
  it('returns nothing for an empty query', () => {
    expect(rankMatches('   ', leaves)).toEqual([]);
  });
});
