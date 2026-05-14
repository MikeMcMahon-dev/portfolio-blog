import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadAllPosts, getPublishedPosts } from './utils/content-loader';

const DIST_DIR = path.join(process.cwd(), 'dist');
const CLIENT_DIR = path.join(DIST_DIR, 'client');
const BLOG_DIR = path.join(CLIENT_DIR, 'blog');

function escapeHtmlEntities(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

describe('MDX Support', () => {
  let mdxPosts: Awaited<ReturnType<typeof loadAllPosts>>;
  let publishedPosts: Awaited<ReturnType<typeof loadAllPosts>>;

  beforeAll(async () => {
    if (!fs.existsSync(DIST_DIR)) {
      throw new Error('Build directory not found. Run `npm run build` first.');
    }
    const allPosts = await loadAllPosts();
    publishedPosts = getPublishedPosts(allPosts);
    mdxPosts = publishedPosts.filter((p) => p.filename.endsWith('.mdx'));
  });

  it('should have at least one published .mdx post', () => {
    expect(mdxPosts.length).toBeGreaterThan(0);
  });

  it('each published .mdx post should be prerendered to HTML', () => {
    for (const post of mdxPosts) {
      const htmlPath = path.join(BLOG_DIR, post.slug, 'index.html');
      expect(
        fs.existsSync(htmlPath),
        `MDX post not prerendered: ${post.slug}`
      ).toBe(true);
    }
  });

  it('.mdx posts render with the same layout structure as .md posts', () => {
    for (const post of mdxPosts) {
      const htmlPath = path.join(BLOG_DIR, post.slug, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      expect(html).toMatch(/<article/i, `MDX post ${post.slug} missing <article>`);

      const title = post.frontmatter.title ?? '';
      const titleInHtml = html.includes(title) || html.includes(escapeHtmlEntities(title));
      expect(titleInHtml).toBe(true, `MDX post ${post.slug} title missing from rendered HTML`);
    }
  });

  // This is the gap that caused the original issue: .mdx posts must appear in
  // the sidebar of prerendered pages under their correct category section.
  it('.mdx post titles appear in sidebar of prerendered .md posts', () => {
    // Use a stable .md reference page for the sidebar HTML
    const reference = publishedPosts.find((p) => p.filename.endsWith('.md'));
    if (!reference) return;

    const html = fs.readFileSync(path.join(BLOG_DIR, reference.slug, 'index.html'), 'utf-8');

    for (const post of mdxPosts) {
      const title = post.frontmatter.title ?? '';
      const inSidebar = html.includes(title) || html.includes(escapeHtmlEntities(title));
      expect(
        inSidebar,
        `MDX post "${title}" (${post.slug}) not found in sidebar of ${reference.slug}`
      ).toBe(true);
    }
  });

  it('.mdx post sidebar link points to the correct slug (no .mdx extension in URL)', () => {
    const reference = publishedPosts.find((p) => p.filename.endsWith('.md'));
    if (!reference) return;

    const html = fs.readFileSync(path.join(BLOG_DIR, reference.slug, 'index.html'), 'utf-8');

    for (const post of mdxPosts) {
      // URL should be /blog/slug, never /blog/slug.mdx
      expect(html).not.toContain(`/blog/${post.slug}.mdx`);
      expect(html).toContain(`/blog/${post.slug}`);
    }
  });

  it('.mdx posts satisfy the same frontmatter schema as .md posts', () => {
    const requiredFields = ['title', 'description', 'pubDate', 'category'] as const;

    for (const post of mdxPosts) {
      for (const field of requiredFields) {
        expect(
          post.frontmatter[field],
          `MDX post ${post.slug} missing required frontmatter field: ${field}`
        ).toBeTruthy();
      }

      const validCategories = ['about', 'sessions', 'projects'];
      expect(
        validCategories.includes(post.frontmatter.category ?? ''),
        `MDX post ${post.slug} has invalid category: ${post.frontmatter.category}`
      ).toBe(true);
    }
  });
});
