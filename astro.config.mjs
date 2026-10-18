import { defineConfig } from 'astro/config';
import { transformerMetaHighlight } from '@shikijs/transformers';

const codeTitles = {
  name: 'code-titles',
  pre(node) {
    const meta = this.options.meta?.__raw ?? '';
    const title = meta.match(/title="([^"]+)"/)?.[1];
    if (title) node.properties['data-title'] = title;
  },
};

export default defineConfig({
  site: 'https://blog.eric.dev.br',
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'pt-BR'],
    routing: { prefixDefaultLocale: false },
  },
  markdown: {
    shikiConfig: {
      themes: { light: 'catppuccin-latte', dark: 'catppuccin-macchiato' },
      defaultColor: false,
      wrap: true,
      transformers: [codeTitles, transformerMetaHighlight()],
    },
  },
});
