// Seeds two recurring portal calendar meetings:
//   - "CLIF WG Meeting" — Thursdays (Zoom + slides deck)
//   - "clifpy package development" — Mondays (Zoom)
//
// Idempotent: re-running is safe. Adds the slides_link column on the
// calendar_events table if missing (matches the additive ALTER pattern in
// scripts/import-member-csv.mjs and scripts/dedupe-stub-members.mjs).
//
// Run: node --env-file=.env scripts/seed-calendar.mjs

import { createClient } from '@libsql/client';

const REQUIRED_COLUMNS = ['slides_link'];

const EVENTS = [
  {
    title: 'CLIF WG Meeting',
    weekday: 4, // Thursday (Sun=0)
    event_type: 'meeting',
    is_recurring: 1,
    meeting_link:
      'https://uchicago.zoom.us/j/92418694599?pwd=CwS0Zu6Jao6Nw3kcQkvMOY6rFivygb.1',
    slides_link:
      'https://docs.google.com/presentation/d/1e-Olet8GyLGTOHwjPAaL6eGwIFVfaOr_EITtYjrlKFQ/edit',
  },
  {
    title: 'clifpy package development',
    weekday: 1, // Monday
    event_type: 'meeting',
    is_recurring: 1,
    meeting_link:
      'https://uchicago.zoom.us/j/97215676968?pwd=l78Rb0IJxJepN5xYpIrkTWFEZtRUcK.1',
    slides_link: null,
  },
];

function lastWeekdayOnOrBefore(targetWeekday) {
  // Returns YYYY-MM-DD for the most-recent date that falls on `targetWeekday`,
  // i.e. today if today's weekday matches, otherwise the prior occurrence.
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - targetWeekday + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}

async function ensureColumns(db) {
  const existing = await db.execute(
    "SELECT name FROM pragma_table_info('calendar_events')"
  );
  const have = new Set(existing.rows.map((r) => r.name));
  for (const col of REQUIRED_COLUMNS) {
    if (!have.has(col)) {
      await db.execute(`ALTER TABLE calendar_events ADD COLUMN ${col} TEXT`);
      console.log(`  + added column calendar_events.${col}`);
    }
  }
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error(
      'TURSO_DATABASE_URL is not set. Run with: node --env-file=.env scripts/seed-calendar.mjs'
    );
    process.exit(1);
  }
  const db = createClient({ url, authToken });

  console.log('Ensuring schema columns…');
  await ensureColumns(db);

  let inserted = 0;
  let already = 0;

  for (const ev of EVENTS) {
    const existing = await db.execute({
      sql: 'SELECT id FROM calendar_events WHERE title = ? LIMIT 1',
      args: [ev.title],
    });
    if (existing.rows.length > 0) {
      console.log(`  · ${ev.title} — already present`);
      already++;
      continue;
    }
    await db.execute({
      sql: `INSERT INTO calendar_events
              (title, event_date, event_type, is_recurring, meeting_link, slides_link)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        ev.title,
        lastWeekdayOnOrBefore(ev.weekday),
        ev.event_type,
        ev.is_recurring,
        ev.meeting_link,
        ev.slides_link,
      ],
    });
    console.log(`  + inserted ${ev.title}`);
    inserted++;
  }

  console.log(`\nDone. Inserted: ${inserted}. Already present: ${already}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
