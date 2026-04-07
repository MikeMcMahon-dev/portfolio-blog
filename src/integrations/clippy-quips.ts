/**
 * Astro integration: Generate Clippy quips at build time
 * Hooks into astro:build:start to run the generation script before the build
 */

import type { AstroIntegration } from 'astro';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function clippyQuipsIntegration(): AstroIntegration {
  return {
    name: 'clippy-quips',
    hooks: {
      'astro:build:start': async () => {
        console.log('[Clippy Quips Integration] Generating quips before build...');

        try {
          // Run the generation script
          execSync('npm run generate:clippy-quips', {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
          });
          console.log('[Clippy Quips Integration] ✅ Quips generated successfully');
        } catch (error) {
          console.warn('[Clippy Quips Integration] ⚠️ Quip generation failed, build will continue with fallback quips');
          // Don't throw — allow build to continue with hardcoded fallback quips
        }
      }
    }
  };
}
