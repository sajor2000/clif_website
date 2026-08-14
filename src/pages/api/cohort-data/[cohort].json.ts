export const prerender = true;
import type { APIRoute, GetStaticPaths } from 'astro';
import { COHORTS } from '../../../utils/cohortData';
import { getExplorerData } from '../../../utils/explorerPayload';

// Per-cohort Data Explorer payloads, prerendered to static JSON. Built from
// the same getExplorerData() call as the /cohort page's SSR shell, so the
// endpoint and the page can never disagree. The client fetches a cohort on
// first Explorer-tab activation instead of the page inlining ~8.5 MB of JSON.
export const getStaticPaths: GetStaticPaths = () =>
  COHORTS.map((c) => ({ params: { cohort: c.key } }));

export const GET: APIRoute = ({ params }) => {
  const payload = getExplorerData().payloads[params.cohort as string];
  if (!payload) return new Response('Not found', { status: 404 });
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
