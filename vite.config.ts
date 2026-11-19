import { viteSingleFile } from 'vite-plugin-singlefile';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  // `vite build --mode single` → dist/perch.html with every script and style inlined (runs from file://).
  plugins: mode === 'single' ? [viteSingleFile({ outputFileName: 'perch.html' })] : [],
  // Rapier's compat build carries ~4 MB of base64 WASM, so the main chunk is big by design.
  build: { emptyOutDir: mode !== 'single', chunkSizeWarningLimit: 8000 },
  // Git worktrees live under .claude/: keep the file watcher out of them.
  server: { watch: { ignored: ['**/.claude/**', '**/out/**', '**/dist/**'] } },
  // No dependency pre-bundling: three and Rapier ship as ES modules, and a shared pre-bundle cache races (EPERM on
  // Windows) when several agents start Vite at once.
  optimizeDeps: { noDiscovery: true, include: [] },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Timing tests run serially in `npm run perf` (D-EP-022), never in the parallel unit run.
    exclude: [...configDefaults.exclude, '**/*.perf.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
}));
