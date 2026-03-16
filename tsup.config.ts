import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist/cli',
  clean: true,
  sourcemap: true,
  // Inject createRequire so CJS dependencies (commander, etc.) can
  // require() Node built-ins when bundled into ESM output.
  banner: {
    js: [
      '#!/usr/bin/env node',
      'import { createRequire as __createRequire } from "module";',
      'const require = __createRequire(import.meta.url);'
    ].join('\n')
  },
  // Bundle all npm dependencies so the CLI is self-contained when
  // shipped inside the Electron app (no node_modules available).
  noExternal: [/.*/],
  platform: 'node'
})
