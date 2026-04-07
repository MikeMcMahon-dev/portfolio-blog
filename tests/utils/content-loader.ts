import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

export interface PostFrontmatter {
  title?: string;
  description?: string;
  pubDate?: string;
  category?: string;
  draft?: boolean;
  updatedDate?: string;
}

export interface Post {
  filename: string;
  slug: string;
  frontmatter: PostFrontmatter;
  content: string;
}

function parseFrontmatter(fileContent: string): PostFrontmatter {
  const match = fileContent.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatterText = match[1];
  const frontmatter: PostFrontmatter = {};

  const titleMatch = frontmatterText.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (titleMatch) frontmatter.title = titleMatch[1].trim();

  const descMatch = frontmatterText.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  if (descMatch) frontmatter.description = descMatch[1].trim();

  const pubDateMatch = frontmatterText.match(
    /^pubDate:\s*(\d{4}-\d{2}-\d{2})/m
  );
  if (pubDateMatch) frontmatter.pubDate = pubDateMatch[1];

  const categoryMatch = frontmatterText.match(/^category:\s*["']?(.+?)["']?\s*$/m);
  if (categoryMatch) frontmatter.category = categoryMatch[1].trim();

  const draftMatch = frontmatterText.match(/^draft:\s*(true|false)/m);
  if (draftMatch) frontmatter.draft = draftMatch[1] === 'true';

  const updatedMatch = frontmatterText.match(
    /^updatedDate:\s*(\d{4}-\d{2}-\d{2})/m
  );
  if (updatedMatch) frontmatter.updatedDate = updatedMatch[1];

  return frontmatter;
}

export async function loadAllPosts(contentDir?: string): Promise<Post[]> {
  const dir = contentDir || path.join(process.cwd(), 'src', 'content', 'blog');
  const files = await fsPromises.readdir(dir);
  const mdFiles = files.filter(
    (f) => f.endsWith('.md') || f.endsWith('.mdx')
  );

  const posts = await Promise.all(
    mdFiles.map(async (filename) => {
      const slug = filename.replace(/\.(md|mdx)$/, '');
      const filePath = path.join(dir, filename);
      const content = await fsPromises.readFile(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      return { filename, slug, frontmatter, content };
    })
  );

  return posts;
}

export function getPublishedPosts(posts: Post[]): Post[] {
  return posts.filter((p) => !p.frontmatter.draft);
}

export function getPostsByCategory(posts: Post[], category: string): Post[] {
  return posts.filter((p) => p.frontmatter.category === category);
}
