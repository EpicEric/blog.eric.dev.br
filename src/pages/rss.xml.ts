import rss from '@astrojs/rss';
import { site } from '../data/site';
import { t } from '../i18n/ui';
import { feedItem } from '../lib/feed';
import { getPosts } from '../lib/posts';

export async function GET(context: { site?: URL }) {
  const posts = await getPosts('en');
  const base = context.site ?? new URL(site.url);

  return rss({
    title: t('en', 'feed.title'),
    description: t('en', 'feed.description'),
    site: base,
    items: posts.map((post) => feedItem(post, 'en', base)),
    customData: `<language>${t('en', 'feed.language')}</language>`,
  });
}
