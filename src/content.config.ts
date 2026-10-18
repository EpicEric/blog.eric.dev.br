import { defineCollection } from 'astro:content';
import * as z from 'astro/zod';
import { glob } from 'astro/loaders';
import { tagKeys } from './data/tags';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    translationKey: z.string(),
    locale: z.enum(['en', 'pt-BR']),
    tags: z.array(z.enum(tagKeys)),
    interactive: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
