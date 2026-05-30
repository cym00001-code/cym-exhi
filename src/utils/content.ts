import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import navigation from '../data/navigation.json';

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

export async function getHomeHalls(): Promise<HallEntry[]> {
  const halls = await getHalls();
  const homeOrder = new Map(navigation.home.hallSlugs.map((slug, index) => [slug, index]));

  return halls
    .filter((hall) => hall.data.showOnHome !== false && homeOrder.has(hall.data.slug))
    .sort((a, b) => {
      const orderA = homeOrder.get(a.data.slug) ?? Number.MAX_SAFE_INTEGER;
      const orderB = homeOrder.get(b.data.slug) ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB || a.data.order - b.data.order;
    });
}

export async function getHallMap(): Promise<Map<string, HallEntry>> {
  const halls = await getHalls(true);
  return new Map(halls.map((hall) => [hall.data.slug, hall]));
}

export async function getPublicExhibitions(): Promise<ExhibitionEntry[]> {
  const hallMap = await getHallMap();
  const exhibitions = await getCollection('exhibitions');
  return exhibitions
    .filter((exhibition) => {
      const hall = hallMap.get(exhibition.data.hallSlug);
      return exhibition.data.status === 'published' && hall?.data.status !== 'hidden';
    })
    .sort((a, b) => {
      const displayA = a.data.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const displayB = b.data.displayOrder ?? Number.MAX_SAFE_INTEGER;
      return displayA - displayB || b.data.date.localeCompare(a.data.date);
    });
}

export async function getExhibitionsForHall(hallSlug: string): Promise<ExhibitionEntry[]> {
  const exhibitions = await getPublicExhibitions();
  return exhibitions.filter((exhibition) => exhibition.data.hallSlug === hallSlug);
}
