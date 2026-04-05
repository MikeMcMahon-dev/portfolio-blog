import type { CollectionEntry } from 'astro:content';

export function renderDigestAsHtml(posts: CollectionEntry<'blog'>[]): string {
  const siteUrl = 'https://mikemcmahon.dev';
  const postsHtml = posts
    .map(
      (post) => `
    <div style="margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid #ddd;">
      <h3 style="margin: 0.5rem 0; color: #333;">
        <a href="${siteUrl}/blog/${post.id}/" style="color: #3D6B7D; text-decoration: none;">
          ${post.data.title}
        </a>
      </h3>
      <p style="margin: 0.25rem 0; font-size: 0.9rem; color: #666;">
        <strong>${formatDate(post.data.pubDate)}</strong> • ${post.data.category}
      </p>
      <p style="margin: 1rem 0; color: #555; line-height: 1.5;">
        ${post.data.description}
      </p>
      <a href="${siteUrl}/blog/${post.id}/" style="color: #3D6B7D; text-decoration: none; font-weight: 500;">
        Read more →
      </a>
    </div>
  `
    )
    .join('');

  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f5f5f5;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: white;
      }
      .header {
        border-bottom: 2px solid #3D6B7D;
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      .header h1 {
        margin: 0;
        color: #333;
        font-size: 24px;
      }
      .header p {
        margin: 10px 0 0 0;
        color: #666;
        font-size: 14px;
      }
      .content {
        margin: 0 0 30px 0;
      }
      .footer {
        border-top: 1px solid #ddd;
        padding-top: 20px;
        margin-top: 30px;
        font-size: 12px;
        color: #999;
        text-align: center;
      }
      .footer a {
        color: #3D6B7D;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>✨ New Posts from Mike McMahon</h1>
        <p>${posts.length} new article${posts.length !== 1 ? 's' : ''} published</p>
      </div>

      <div class="content">
        ${postsHtml}
      </div>

      <div class="footer">
        <p>
          <a href="${siteUrl}">Visit the blog</a> •
          <a href="${siteUrl}/rss.xml">Subscribe via RSS</a>
        </p>
        <p style="margin-top: 15px; color: #ccc;">
          Built with Claude AI • © ${year} Mike McMahon
        </p>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return new Date(date).toLocaleDateString('en-US', options);
}
