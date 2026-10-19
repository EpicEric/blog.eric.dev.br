import rss from '@astrojs/rss';
import { site } from '../../data/site';
import { t } from '../../i18n/ui';
import { feedItem } from '../../lib/feed';
import { getPosts } from '../../lib/posts';

export async function GET(context: { site?: URL }) {
  const posts = await getPosts('pt-BR');
  const base = context.site ?? new URL(site.url);

  return rss({
    title: t('pt-BR', 'feed.title'),
    description: t('pt-BR', 'feed.description'),
    site: base,
    items: posts.map((post) => feedItem(post, 'pt-BR', base)),
    customData: `<language>${t('pt-BR', 'feed.language')}</language>`,
  });
}
