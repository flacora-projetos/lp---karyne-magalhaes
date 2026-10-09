/// <reference types="vite/client" />

const titles = import.meta.glob<string>('../../content/blog/published/*.json', { eager: true, import: 'title' });
const slugs = import.meta.glob<string>('../../content/blog/published/*.json', { eager: true, import: 'slug' });

export const blogArticleTitles: Record<string, string> = Object.fromEntries(
  Object.keys(slugs).map(path => [slugs[path], titles[path]]),
);
