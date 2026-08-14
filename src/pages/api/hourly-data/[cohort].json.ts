export const prerender = true;
import type { APIRoute, GetStaticPaths } from 'astro';
import { getHourlyData, HOURLY_COHORTS } from '../../../utils/hourlyPayload';

// Per-cohort Hourly Trends payloads, prerendered to static JSON. Built from
// the same getHourlyData() call as the /cohort page's SSR shell; the client
// fetches a cohort on first Hourly-tab activation instead of the page
// inlining ~2.3 MB of JSON.
export const getStaticPaths: GetStaticPaths = () =>
  HOURLY_COHORTS.map((c) => ({ params: { cohort: c.key } }));

export const GET: APIRoute = ({ params }) => {
  const payload = getHourlyData().payloads[params.cohort as string];
  if (!payload) return new Response('Not found', { status: 404 });
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
