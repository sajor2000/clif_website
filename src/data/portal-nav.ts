// Single source of truth for the members-portal page list. Both the sidebar
// (PortalNav.astro) and the dashboard cards (pages/portal/index.astro) render
// from these groups, so a new portal page is added here once.

export interface PortalItem {
  label: string;
  href: string;
  /** Key into ICON_PATHS in PortalNav.astro (shown when the sidebar is collapsed). */
  icon: string;
  /** Card blurb on the portal dashboard. */
  description: string;
  wip?: boolean;
}

export interface PortalGroup {
  title: string;
  items: PortalItem[];
}

// Groups render in this order; items are alphabetical by label within a group.
export const portalGroups: PortalGroup[] = [
  {
    title: 'Trackers',
    items: [
      {
        label: 'Letters of Support',
        href: '/portal/los-requests',
        icon: 'document',
        description: 'Request a consortium letter of support for a grant; steering approves support',
      },
      {
        label: 'Manuscripts',
        href: '/portal/status',
        icon: 'check-circle',
        description: 'Consortium manuscripts: status, leads, journals, and repositories',
      },
      {
        label: 'Project Runs',
        href: '/portal/project-runs',
        icon: 'check-circle',
        description: 'Request that the consortium run a project and track which sites have run it',
      },
    ],
  },
  {
    title: 'Tools',
    items: [
      {
        label: 'Authorship Block',
        href: '/portal/authorship',
        icon: 'document',
        description:
          'Build a formatted author block (Vancouver / AMA) with numbered affiliations for abstracts, manuscripts, grants, and posters',
      },
      {
        label: 'mCIDE Surveyor',
        href: '/portal/mcide-surveyor',
        icon: 'check-circle',
        description:
          'What every site maps its raw EHR names to: look up a string, see inside vague categories like "other", and find where sites disagree',
      },
      {
        label: 'Secure Masking',
        href: '/portal/crypto',
        icon: 'lock',
        description: 'Deterministic additive masking for secure count data aggregation',
      },
    ],
  },
  {
    title: 'Consortium',
    items: [
      {
        label: 'Calendar',
        href: '/portal/calendar',
        icon: 'calendar',
        description: 'Upcoming meetings, events, and Zoom links',
      },
      {
        label: 'Hospital & Site Details',
        href: '/portal/site-details',
        icon: 'building',
        description: 'Institution metadata, data sources, date ranges, and ICU bed counts',
      },
      {
        label: 'Member Directory',
        href: '/portal/directory',
        icon: 'users',
        description: 'Contact information for consortium members',
      },
      {
        label: 'Voting',
        href: '/portal/voting',
        icon: 'ballot',
        description: 'Vote on consortium proposals and view results',
      },
    ],
  },
];
