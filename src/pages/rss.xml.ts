import rss from '@astrojs/rss';
import { site } from '../data/site';
import { postPath, t } from '../i18n/ui';
import { getPosts } from '../lib/posts';

export async function GET(context: { site?: URL }) {
  const posts = await getPosts('en');
  const base = context.site ?? new URL(site.url);

  return rss({
    title: t('en', 'feed.title'),
    description: t('en', 'feed.description'),
    site: base,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: new URL(postPath('en', post.data.translationKey), base).href,
    })),
    customData: `<language>${t('en', 'feed.language')}</language>`,
  });
}
