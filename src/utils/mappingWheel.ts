// The Mapping Wheel's geometry-free half: how leaves are clustered into the
// dendrogram and how a search picks the leaf to spin to. Pure functions, so
// the browser and the test suite share them.

import { norm } from './mcideMappings';

export interface WheelLeaf {
  id: string;
  label: string;
  /** Records behind the leaf; sets tick weight and breaks ties. */
  weight: number;
}

/** A node of the dendrogram: an inner merge, or a leaf. */
export interface WheelNode {
  leaf?: WheelLeaf;
  children?: WheelNode[];
  /** Merge height in [0, 1]: 1 - average similarity of the two sides. */
  height: number;
}

/** Character trigrams of the comparison form of a string, padded at the ends. */
export function trigrams(s: string): Set<string> {
  const t = `  ${norm(s)} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

/** Dice coefficient of two trigram sets, 0 (nothing shared) to 1 (identical). */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const g of a) if (b.has(g)) shared++;
  return (2 * shared) / (a.size + b.size);
}

/**
 * Agglomerative average-linkage clustering of the leaves by string
 * similarity, so neighbours on the rim are strings that look alike and the
 * tree inside the wheel is the order of their resemblance.
 *
 * O(n³) with a flat distance matrix — fine for the ≤ MAX_LEAVES a wheel shows.
 * Leaves come back sorted by weight inside ties so the layout is stable.
 */
export function clusterLeaves(leaves: WheelLeaf[]): WheelNode {
  const n = leaves.length;
  if (n === 0) return { children: [], height: 1 };
  if (n === 1) return { leaf: leaves[0], height: 0 };

  const grams = leaves.map((l) => trigrams(l.label));
  // dist[i*n+j]: 1 - similarity. Only i<j is read.
  const dist = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) dist[i * n + j] = 1 - similarity(grams[i], grams[j]);
  }

  // Active clusters: index → { node, size }. Merged clusters keep their
  // row/col (Lance–Williams average update) under the surviving index.
  const nodes: (WheelNode | null)[] = leaves.map((leaf) => ({ leaf, height: 0 }));
  const size = new Int32Array(n).fill(1);
  let active = n;

  while (active > 1) {
    let best = Infinity;
    let bi = -1;
    let bj = -1;
    for (let i = 0; i < n; i++) {
      if (!nodes[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!nodes[j]) continue;
        const d = dist[i * n + j];
        if (d < best || (d === best && size[i] + size[j] < size[bi] + size[bj])) {
          best = d;
          bi = i;
          bj = j;
        }
      }
    }
    const merged: WheelNode = { children: [nodes[bi]!, nodes[bj]!], height: best };
    // Average linkage: d(k, i∪j) = (|i| d(k,i) + |j| d(k,j)) / (|i|+|j|)
    for (let k = 0; k < n; k++) {
      if (!nodes[k] || k === bi || k === bj) continue;
      const dki = dist[Math.min(k, bi) * n + Math.max(k, bi)];
      const dkj = dist[Math.min(k, bj) * n + Math.max(k, bj)];
      dist[Math.min(k, bi) * n + Math.max(k, bi)] = (size[bi] * dki + size[bj] * dkj) / (size[bi] + size[bj]);
    }
    nodes[bi] = merged;
    size[bi] += size[bj];
    nodes[bj] = null;
    active--;
  }
  return nodes.find(Boolean)!;
}

/** Leaves in rim order (depth-first). */
export function leavesOf(node: WheelNode, out: WheelLeaf[] = []): WheelLeaf[] {
  if (node.leaf) out.push(node.leaf);
  else for (const c of node.children ?? []) leavesOf(c, out);
  return out;
}

/**
 * The rim's coloured sectors: `k` families from the top of the tree, each as
 * the leaf ids it covers, in rim order. Average linkage tends to peel single
 * outliers off first, so the split always goes to the family holding the
 * most leaves — that keeps the sectors comparable in size instead of one
 * sector wrapping most of the rim.
 */
export function topClades(root: WheelNode, k: number): WheelLeaf[][] {
  const frontier: WheelNode[] = [root];
  const sizeOf = (nd: WheelNode) => leavesOf(nd).length;
  while (frontier.length < k) {
    let idx = -1;
    let biggest = 1;
    frontier.forEach((nd, i) => {
      const s = nd.children ? sizeOf(nd) : 0;
      if (s > biggest) {
        biggest = s;
        idx = i;
      }
    });
    if (idx === -1) break;
    frontier.splice(idx, 1, ...frontier[idx].children!);
  }
  // Restore rim order: sort by the position of each clade's first leaf.
  const order = new Map(leavesOf(root).map((l, i) => [l.id, i]));
  return frontier
    .map((nd) => leavesOf(nd))
    .sort((a, b) => order.get(a[0].id)! - order.get(b[0].id)!);
}

export interface Match {
  leaf: WheelLeaf;
  /** 1 for the same string after norm(); otherwise the trigram Dice score. */
  score: number;
  exact: boolean;
}

/**
 * Rank the wheel's leaves against a query. Exact (post-norm) matches first,
 * then substring hits, then by trigram similarity; ties by weight.
 */
export function rankMatches(query: string, leaves: WheelLeaf[], limit = 5): Match[] {
  const q = norm(query);
  if (!q) return [];
  const qg = trigrams(query);
  const scored: Match[] = leaves.map((leaf) => {
    const l = norm(leaf.label);
    if (l === q) return { leaf, score: 1, exact: true };
    const sim = similarity(qg, trigrams(leaf.label));
    const contains = l.includes(q) || q.includes(l);
    return { leaf, score: contains ? Math.max(sim, 0.6) : sim, exact: false };
  });
  return scored
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || b.leaf.weight - a.leaf.weight)
    .slice(0, limit);
}

/** The largest wheel we lay out; beyond it, search reaches the rest. */
export const MAX_LEAVES = 400;
