export const locales = ['en', 'pt-BR'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const site = {
  name: 'Epic Eric',
  author: 'Eric Rodrigues Pires',
  email: 'eric@eric.dev.br',
  url: 'https://blog.eric.dev.br',
  mainSite: 'https://eric.dev.br',
  description: {
    en: 'Blogging from Brazil.',
    'pt-BR': 'Blogando do Brasil.',
  },
  intro: {
    en: 'Hey there! This is my new place for sharing random thoughts and ideas, as well as whatever I’m currently working on.',
    'pt-BR':
      'Olá! Este é o novo lugar para eu compartilhar ideias e pensamentos aleatórios, além do que eu estiver mexendo no momento.',
  },
  title: {
    en: "Epic Eric's blog",
    'pt-BR': 'Blog do Epic Eric',
  },
  socials: [
    { key: 'website', label: 'Website', href: 'https://eric.dev.br' },
    { key: 'github', label: 'GitHub', href: 'https://github.com/EpicEric' },
    { key: 'codeberg', label: 'Codeberg', href: 'https://codeberg.org/EpicEric9' },
    { key: 'mastodon', label: 'Mastodon', href: 'https://mastodon.xyz/@epiceric' },
    { key: 'kofi', label: 'Ko-fi', href: 'https://ko-fi.com/epiceric' },
  ],
} as const;

export type SocialKey = (typeof site.socials)[number]['key'];
