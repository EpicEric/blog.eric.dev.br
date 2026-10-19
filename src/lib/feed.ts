import type { Locale } from '../data/site';
import { tagFor } from '../data/tags';
import { postPath } from '../i18n/ui';
import type { Post } from './posts';

function absoluteUrls(html: string, base: URL, postUrl: string): string {
  return html
    .replace(
      /\b(href|src)="(\/(?!\/)[^"]*)"/g,
      (_match, attribute: string, path: string) =>
        `${attribute}="${new URL(path, base).href}"`,
    )
    .replace(
      /\bsrcset="([^"]*)"/g,
      (_match, value: string) =>
        `srcset="${value
          .split(',')
          .map((candidate) => {
            const [url, descriptor] = candidate.trim().split(/\s+/, 2);
            return `${new URL(url, base).href}${descriptor ? ` ${descriptor}` : ''}`;
          })
          .join(', ')}"`,
    )
    .replace(/\bhref="#([^"]*)"/g, (_match, fragment: string) => `href="${postUrl}#${fragment}"`);
}

export function feedItem(post: Post, locale: Locale, base: URL) {
  const link = new URL(postPath(locale, post.data.translationKey), base).href;
  const html = post.rendered?.html;

  if (!html) {
    throw new Error(`Missing rendered HTML for RSS item: ${post.id}`);
  }

  return {
    title: post.data.title,
    description: post.data.description,
    pubDate: post.data.date,
    link,
    categories: post.data.tags.map((tag) => tagFor(tag, locale).label),
    content: absoluteUrls(html, base, link),
  };
}
