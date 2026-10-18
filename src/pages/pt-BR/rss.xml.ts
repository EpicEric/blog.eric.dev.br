import rss from '@astrojs/rss';
import { site } from '../../data/site';
import { postPath, t } from '../../i18n/ui';
import { getPosts } from '../../lib/posts';

export async function GET(context: { site?: URL }) {
  const posts = await getPosts('pt-BR');
  const base = context.site ?? new URL(site.url);

  return rss({
    title: t('pt-BR', 'feed.title'),
    description: t('pt-BR', 'feed.description'),
    site: base,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: new URL(postPath('pt-BR', post.data.translationKey), base).href,
    })),
    customData: `<language>${t('pt-BR', 'feed.language')}</language>`,
  });
}
