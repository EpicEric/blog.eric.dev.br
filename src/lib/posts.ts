import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '../data/site';
import { tagKeys, type TagKey } from '../data/tags';

export type Post = CollectionEntry<'posts'>;

export async function getPosts(locale: Locale): Promise<Post[]> {
  const includeDrafts = import.meta.env.DEV;
  const posts = await getCollection(
    'posts',
    ({ data }) => data.locale === locale && (includeDrafts || !data.draft),
  );
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getPost(locale: Locale, key: string): Promise<Post | undefined> {
  const posts = await getPosts(locale);
  return posts.find((post) => post.data.translationKey === key);
}

export async function getPostsByTag(locale: Locale, tag: TagKey): Promise<Post[]> {
  const posts = await getPosts(locale);
  return posts.filter((post) => post.data.tags.includes(tag));
}

export async function getTagsWithPosts(locale: Locale) {
  const posts = await getPosts(locale);
  return tagKeys
    .map((key) => ({
      key,
      posts: posts.filter((post) => post.data.tags.includes(key)),
    }))
    .filter((entry) => entry.posts.length > 0);
}

export function readingMinutes(post: Post): number {
  const words = post.body?.trim().split(/\s+/).length ?? 0;
  return Math.max(1, Math.round(words / 200));
}
