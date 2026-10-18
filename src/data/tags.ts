import type { Locale } from './site';

type TagTranslation = {
  label: string;
  slug: string;
  description: string;
};

export const tagKeys = ['sandhole', 'self-hosting', 'nix', 'rust', 'testing', 'now'] as const;

export const tags = {
  sandhole: {
    en: {
      label: 'Sandhole',
      slug: 'sandhole',
      description: 'Notes on Sandhole, my reverse proxy.',
    },
    'pt-BR': {
      label: 'Sandhole',
      slug: 'sandhole',
      description: 'Notas sobre meu proxy reverso, Sandhole.',
    },
  },
  'self-hosting': {
    en: {
      label: 'self-hosting',
      slug: 'self-hosting',
      description: 'Running your own services.',
    },
    'pt-BR': {
      label: 'auto-hospedagem',
      slug: 'auto-hospedagem',
      description: 'Rodando seus próprios serviços.',
    },
  },
  nix: {
    en: {
      label: 'Nix',
      slug: 'nix',
      description: 'Reproducible builds and environments.',
    },
    'pt-BR': {
      label: 'Nix',
      slug: 'nix',
      description: 'Builds e ambientes reproduzíveis.',
    },
  },
  rust: {
    en: {
      label: 'Rust',
      slug: 'rust',
      description: 'Systems programming all the way to high-level.',
    },
    'pt-BR': {
      label: 'Rust',
      slug: 'rust',
      description: 'Programação de sistemas até o alto nível.',
    },
  },
  testing: {
    en: {
      label: 'testing',
      slug: 'testing',
      description: 'How to deal with tests.',
    },
    'pt-BR': {
      label: 'testes',
      slug: 'testes',
      description: 'Como lidar com testes.',
    },
  },
  now: {
    en: {
      label: 'now',
      slug: 'now',
      description: 'The Nix-based command runner.',
    },
    'pt-BR': {
      label: 'now',
      slug: 'now',
      description: 'O executor de comandos baseado em Nix.',
    },
  },
} as const satisfies Record<TagKey, Record<Locale, TagTranslation>>;

export type TagKey = (typeof tagKeys)[number];

export function tagFor(tag: TagKey, locale: Locale) {
  return tags[tag][locale];
}

export function tagFromSlug(slug: string, locale: Locale): TagKey | undefined {
  return tagKeys.find((key) => tags[key][locale].slug === slug);
}
