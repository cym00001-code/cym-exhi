import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';

export type HallEntry = CollectionEntry<'halls'>;
export type ExhibitionEntry = CollectionEntry<'exhibitions'>;
export type ExhibitionPhoto = ExhibitionEntry['data']['photos'][number];

const imageModules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{avif,jpeg,jpg,png,webp}',
  { eager: true },
);

export function resolveImage(src: string): ImageMetadata {
  const image = imageModules[src];

  if (!image) {
    throw new Error(`Image asset not found: ${src}`);
  }

  return image.default;
}

export async function getHalls(includeHidden = false): Promise<HallEntry[]> {
  const halls = await getCollection('halls');
  return halls
    .filter((hall) => includeHidden || hall.data.status !== 'hidden')
    .sort((a, b) => a.data.order - b.data.order);
}

export async function getHallMap(): Promise<Map<string, HallEntry>> {
  const halls = await getHalls(true);
  return new Map(halls.map((hall) => [hall.data.slug, hall]));
}

export async function getPublicExhibitions(): Promise<ExhibitionEntry[]> {
  const exhibitions = await getCollection('exhibitions');
  return exhibitions
    .filter((exhibition) => exhibition.data.status === 'published')
    .sort((a, b) => b.data.date.localeCompare(a.data.date));
}

export async function getExhibitionsForHall(hallSlug: string): Promise<ExhibitionEntry[]> {
  const exhibitions = await getPublicExhibitions();
  return exhibitions.filter((exhibition) => exhibition.data.hallSlug === hallSlug);
}
