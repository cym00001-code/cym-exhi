import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const hallStatus = z.enum(['active', 'arranging', 'hidden']);
const exhibitionStatus = z.enum(['draft', 'published', 'hidden']);
const photoOrientation = z.enum(['landscape', 'portrait', 'square']);

const halls = defineCollection({
  loader: glob({ base: './src/content/halls', pattern: '**/*.json' }),
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    englishName: z.string(),
    description: z.string(),
    mood: z.array(z.string()),
    status: hallStatus,
    order: z.number(),
    tone: z.enum(['warm', 'blue-gray', 'brown-gray', 'daily', 'monochrome']).default('warm'),
  }),
});

const exhibitions = defineCollection({
  loader: glob({ base: './src/content/exhibitions', pattern: '**/*.json' }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    subtitle: z.string(),
    hallSlug: z.string(),
    date: z.string(),
    dateLabel: z.string().optional(),
    location: z.string(),
    cover: z.string(),
    intro: z.string(),
    status: exhibitionStatus,
    featured: z.boolean().default(false),
    photos: z.array(
      z.object({
        src: z.string(),
        alt: z.string(),
        caption: z.string(),
        location: z.string().optional(),
        date: z.string().optional(),
        orientation: photoOrientation,
      }),
    ),
  }),
});

export const collections = { halls, exhibitions };
