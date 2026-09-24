import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Vercel cron jobs call their path with an HTTP GET. A handler that only exports
// POST answers every scheduled run with a 404, writes nothing, and raises nothing -
// which is how the newsletter went five months without sending.

const root = join(__dirname, '..');
const vercelConfig = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf-8'));
const crons: { path: string; schedule: string }[] = vercelConfig.crons ?? [];

function routeFileFor(cronPath: string): string | undefined {
  const base = join(root, 'src/pages', cronPath.split('?')[0]);
  return ['.ts', '.js'].map((ext) => base + ext).find(existsSync);
}

describe('Vercel cron routes', () => {
  it('declares at least one cron', () => {
    expect(crons.length).toBeGreaterThan(0);
  });

  it.each(crons.map((c) => [c.path]))('%s exists as a route file', (cronPath) => {
    expect(routeFileFor(cronPath), `no src/pages file for ${cronPath}`).toBeDefined();
  });

  it.each(crons.map((c) => [c.path]))('%s exports a GET handler', (cronPath) => {
    const file = routeFileFor(cronPath);
    const source = file ? readFileSync(file, 'utf-8') : '';
    expect(source).toMatch(/export\s+(const|async\s+function|function)\s+GET\b/);
  });
});
