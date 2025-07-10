import { defineCollection, z } from 'astro:content';

const team = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    role: z.string(),
    institution: z.string(),
    image: z.string(),
    googleScholar: z.string().optional(),
    linkedin: z.string().optional(),
    pubmed: z.string().optional(),
    order: z.number().default(999),
    category: z.enum(['steering-committee', 'site-member', 'collaborator']),
    siteRole: z.string().optional(), // For site-specific roles
  }),
});

const publications = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()),
    journal: z.string(),
    year: z.number(),
    doi: z.string().optional(),
    pmid: z.string().optional(),
    link: z.string(),
    abstract: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const tools = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    features: z.array(z.string()),
    link: z.string(),
    github: z.string().optional(),
    documentation: z.string().optional(),
    icon: z.string().default('package'),
    order: z.number().default(999),
    category: z.enum(['etl', 'analysis', 'visualization', 'documentation']),
  }),
});

const institutions = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    shortName: z.string(),
    logo: z.string(),
    website: z.string(),
    location: z.object({
      city: z.string(),
      state: z.string(),
      lat: z.number(),
      lng: z.number(),
    }),
    stats: z
      .object({
        patients: z.string().optional(),
        dataPoints: z.string().optional(),
        researchers: z.number().optional(),
      })
      .optional(),
    joinedYear: z.number(),
    order: z.number().default(999),
  }),
});

export const collections = {
  team,
  publications,
  tools,
  institutions,
};
