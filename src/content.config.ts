import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const hallStatus = z.enum(['active', 'hidden']);
const exhibitionStatus = z.enum(['draft', 'published', 'hidden']);
const photoOrientation = z.enum(['landscape', 'portrait', 'square', 'unknown']);

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
    showOnHome: z.boolean().default(true),
    cover: z.string().optional(),
    tone: z.enum(['warm', 'blue-gray', 'brown-gray', 'daily', 'monochrome']).default('warm'),
    accent: z.string().optional(),
    layoutHint: z.string().optional(),
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
    displayOrder: z.number().optional(),
    chapters: z
      .array(
        z.object({
          title: z.string(),
          note: z.string().optional(),
        }),
      )
      .optional(),
    seo: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
      })
      .optional(),
    photos: z.array(
      z.object({
        src: z.string(),
        alt: z.string(),
        caption: z.string(),
        location: z.string().optional(),
        date: z.string().optional(),
        orientation: photoOrientation,
        isCover: z.boolean().optional(),
        order: z.number().optional(),
      }),
    ),
  }),
});

export const collections = { halls, exhibitions };
