import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadAllPosts, getPublishedPosts } from './utils/content-loader';

const DIST_DIR = path.join(process.cwd(), 'dist');
const CLIENT_DIR = path.join(DIST_DIR, 'client');
const BLOG_DIR = path.join(CLIENT_DIR, 'blog');

describe('Build Completeness', () => {
  let publishedPosts: any[] = [];

  beforeAll(async () => {
    if (!fs.existsSync(DIST_DIR)) {
      throw new Error('Build directory not found. Run `npm run build` first.');
    }

    const allPosts = await loadAllPosts();
    publishedPosts = getPublishedPosts(allPosts);
  });

  it('should have prerendered all published posts', async () => {
    expect(fs.existsSync(BLOG_DIR)).toBe(true);

    const prerenderedCount = fs
      .readdirSync(BLOG_DIR)
      .filter((f) => {
        const stat = fs.statSync(path.join(BLOG_DIR, f));
        return stat.isDirectory();
      }).length;

    expect(prerenderedCount).toBeGreaterThanOrEqual(publishedPosts.length);
  });

  it('each published post should have prerendered HTML', () => {
    for (const post of publishedPosts) {
      const htmlPath = path.join(BLOG_DIR, post.slug, 'index.html');
      expect(fs.existsSync(htmlPath)).toBe(true,
        `Missing prerendered HTML for post: ${post.slug}`);
    }
  });

  it('prerendered HTML should not be empty or truncated', () => {
    for (const post of publishedPosts) {
      const htmlPath = path.join(BLOG_DIR, post.slug, 'index.html');
      const content = fs.readFileSync(htmlPath, 'utf-8');

      expect(content.length).toBeGreaterThan(500,
        `Post ${post.slug} HTML is too small (possibly truncated)`);

      // Verify it looks like valid HTML
      expect(content).toMatch(/<html|<!DOCTYPE/i,
        `Post ${post.slug} HTML doesn't start with valid HTML`);

      // Verify it contains the post title
      expect(content).toContain(post.frontmatter.title,
        `Post ${post.slug} HTML doesn't contain title: ${post.frontmatter.title}`);
    }
  });

  it('prerendered posts should have proper layout structure', () => {
    for (const post of publishedPosts) {
      const htmlPath = path.join(BLOG_DIR, post.slug, 'index.html');
      const content = fs.readFileSync(htmlPath, 'utf-8');

      // Check for expected structure
      expect(content).toMatch(/<main|<article/i,
        `Post ${post.slug} missing main/article tag`);

      // Should have some heading content
      expect(content).toMatch(/<h[1-6]/i,
        `Post ${post.slug} missing headings`);
    }
  });

  it('no published posts should be missing from build', () => {
    const builtSlugs = fs
      .readdirSync(BLOG_DIR)
      .filter((f) => {
        const stat = fs.statSync(path.join(BLOG_DIR, f));
        return stat.isDirectory();
      });

    const publishedSlugs = publishedPosts.map((p) => p.slug);
    const missing = publishedSlugs.filter((slug) => !builtSlugs.includes(slug));

    expect(missing.length).toBe(0,
      `Published posts missing from build: ${missing.join(', ')}`);
  });

  it('draft posts should not be in build output', async () => {
    const allPosts = await loadAllPosts();
    const draftSlugs = allPosts
      .filter((p) => p.frontmatter.draft)
      .map((p) => p.slug);

    if (draftSlugs.length === 0) {
      // Skip if no drafts exist
      return;
    }

    const builtSlugs = fs
      .readdirSync(BLOG_DIR)
      .filter((f) => {
        const stat = fs.statSync(path.join(BLOG_DIR, f));
        return stat.isDirectory();
      });

    const draftInBuild = draftSlugs.filter((slug) => builtSlugs.includes(slug));
    expect(draftInBuild.length).toBe(0,
      `Draft posts should not be in build: ${draftInBuild.join(', ')}`);
  });
});
