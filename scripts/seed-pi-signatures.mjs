// Load site PI signature images into pi_signatures from a folder of files.
//
// Usage:
//   node --env-file=.env scripts/seed-pi-signatures.mjs <folder>           # dry run: show the matches
//   node --env-file=.env scripts/seed-pi-signatures.mjs <folder> --apply   # write them
//
// Files are matched to members by the last word of the file name, e.g.
// will_parker.png → the one approved user whose last name is "parker" (a
// hyphenated last name such as Field-Singh also matches "singh"). Only PNG
// and JPEG are accepted; convert anything else first. A file that matches no
// user, or more than one, is reported and skipped, never guessed.

import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { createClient } from '@libsql/client';

const folder = process.argv[2];
const apply = process.argv.includes('--apply');
if (!folder) {
  console.error('Usage: node --env-file=.env scripts/seed-pi-signatures.mjs <folder> [--apply]');
  process.exit(1);
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error('TURSO_DATABASE_URL is not set (run with --env-file=.env).');
  process.exit(1);
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function sniff(b) {
  if (b.length > 24 && PNG.every((v, i) => b[i] === v)) {
    return { mime: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
      const len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { mime: 'image/jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      if (m === 0xd9 || m === 0xda) return null;
      i += 2 + len;
    }
  }
  return null;
}

function lastNameOf(fullName) {
  const parts = String(fullName || '').replace(/,.*$/, '').trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && /^(jr\.?|sr\.?|ii|iii|iv|md|phd)$/i.test(parts[parts.length - 1])) parts.pop();
  return (parts[parts.length - 1] || '').toLowerCase();
}

async function main() {
  const db = createClient({ url, authToken });
  const { rows: users } = await db.execute(
    `SELECT id, full_name, email, institution, is_site_pi FROM users WHERE is_approved = 1 AND full_name IS NOT NULL`,
  );

  const files = readdirSync(folder).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
  if (files.length === 0) {
    console.error(`No .png / .jpg files in ${folder}`);
    process.exit(1);
  }

  const plan = [];
  for (const file of files) {
    const stem = basename(file, extname(file)).toLowerCase();
    const key = stem.split(/[_\-\s.]+/).filter(Boolean).pop();
    const matches = users.filter((u) => {
      const last = lastNameOf(u.full_name);
      return last === key || last.split('-').includes(key);
    });
    const bytes = readFileSync(join(folder, file));
    const info = sniff(bytes);
    let problem = null;
    if (!info) problem = 'not a PNG or JPEG';
    else if (bytes.length > 500 * 1024) problem = `too large (${Math.round(bytes.length / 1024)} KB > 500 KB)`;
    else if (matches.length === 0) problem = `no member with last name "${key}"`;
    else if (matches.length > 1) problem = `ambiguous: ${matches.map((m) => `${m.full_name} <${m.email}>`).join(', ')}`;
    plan.push({ file, key, user: matches[0], info, bytes, problem });
  }

  for (const p of plan) {
    if (p.problem) {
      console.log(`SKIP  ${p.file.padEnd(24)} ${p.problem}`);
    } else {
      const pi = p.user.is_site_pi ? '' : '  (not flagged as site PI)';
      console.log(`OK    ${p.file.padEnd(24)} → ${p.user.full_name} <${p.user.email}> ${p.info.width}x${p.info.height}${pi}`);
    }
  }

  const ready = plan.filter((p) => !p.problem);
  if (!apply) {
    console.log(`\nDry run: ${ready.length} of ${plan.length} files would be written. Re-run with --apply to write them.`);
    return;
  }

  const now = new Date().toISOString();
  for (const p of ready) {
    await db.execute({
      sql: `INSERT INTO pi_signatures (user_id, mime, data, width, height, updated_at) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET mime = excluded.mime, data = excluded.data,
              width = excluded.width, height = excluded.height, updated_at = excluded.updated_at`,
      args: [p.user.id, p.info.mime, p.bytes, p.info.width, p.info.height, now],
    });
  }
  console.log(`\nWrote ${ready.length} signatures.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
