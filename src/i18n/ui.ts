import type { Locale } from '../data/site';

const ui = {
  en: {
    'nav.index': 'Posts',
    'nav.tags': 'Tags',
    'nav.feed': 'RSS',
    'nav.home': 'Epic Eric’s blog, home',
    'site.model': 'Blog terminal',
    'index.status': 'Directory',
    'index.latest': 'Latest posts',
    'index.empty': 'No posts found.',
    'tags.title': 'Tags',
    'tags.intro': 'Every tag in the archive.',
    'tag.entries': 'posts',
    'tag.entry': 'post',
    'tag.list': 'Posts',
    'post.reading': 'min read',
    'post.published': 'Published on',
    'post.filed': 'Tagged under',
    'post.back': 'Back to home',
    'post.contents': 'Contents',
    'post.sections': 'sections',
    'theme.toLight': 'Switch to light mode',
    'theme.toDark': 'Switch to dark mode',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'language.label': 'Language',
    'language.en': 'English',
    'language.pt': 'Português do Brasil',
    'footer.ports': 'External connections',
    'footer.built': 'Built with Astro',
    'feed.title': "Epic Eric's blog",
    'feed.description': 'Blogging from Brazil. Notes on code, Nix, Rust, and self-hosting.',
    'feed.language': 'en-US',
    'rss.label': 'RSS feed',
    'a11y.skip': 'Skip to content',
    'a11y.mainNav': 'Main',
    'code.copy': 'Copy',
    'code.copied': 'Copied',
    'code.copyLabel': 'Copy code block',
  },
  'pt-BR': {
    'nav.index': 'Postagens',
    'nav.tags': 'Marcadores',
    'nav.feed': 'RSS',
    'nav.home': 'Blog do Epic Eric, início',
    'site.model': 'Terminal de blog',
    'index.status': 'Diretório',
    'index.latest': 'Últimas postagens',
    'index.empty': 'Nenhuma postagem encontrada.',
    'tags.title': 'Marcadores',
    'tags.intro': 'Todos os marcadores do arquivo.',
    'tag.entries': 'postagens',
    'tag.entry': 'postagem',
    'tag.list': 'Postagens',
    'post.reading': 'min de leitura',
    'post.published': 'Publicado em',
    'post.filed': 'Marcado como',
    'post.back': 'Voltar ao início',
    'post.contents': 'Conteúdo',
    'post.sections': 'seções',
    'theme.toLight': 'Mudar para o modo claro',
    'theme.toDark': 'Mudar para o modo escuro',
    'theme.light': 'Claro',
    'theme.dark': 'Escuro',
    'language.label': 'Idioma',
    'language.en': 'English',
    'language.pt': 'Português do Brasil',
    'footer.ports': 'Conexões externas',
    'footer.built': 'Feito com Astro',
    'feed.title': 'Blog do Epic Eric',
    'feed.description': 'Blogando do Brasil. Notas sobre código, Nix, Rust e auto-hospedagem.',
    'feed.language': 'pt-BR',
    'rss.label': 'Feed RSS',
    'a11y.skip': 'Pular para o conteúdo',
    'a11y.mainNav': 'Principal',
    'code.copy': 'Copiar',
    'code.copied': 'Copiado',
    'code.copyLabel': 'Copiar bloco de código',
  },
} as const;

export type UIKey = keyof (typeof ui)['en'];

export function t(locale: Locale, key: UIKey): string {
  return ui[locale][key];
}

export function postPath(locale: Locale, slug: string): string {
  return `${locale === 'en' ? '' : `/${locale}`}/${slug}/`;
}

export function tagPath(locale: Locale, slug: string): string {
  return `${locale === 'en' ? '' : `/${locale}`}/tags/${slug}/`;
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatMachineDate(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '.');
}

export function tagCountLabel(locale: Locale, count: number): string {
  const one = locale === 'en' ? 'tag' : 'marcador';
  const many = locale === 'en' ? 'tags' : 'marcadores';
  return `${count} ${count === 1 ? one : many}`;
}

export function countLabel(locale: Locale, count: number): string {
  const word = count === 1 ? t(locale, 'tag.entry') : t(locale, 'tag.entries');
  return `${count} ${word}`;
}
