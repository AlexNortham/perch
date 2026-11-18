import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', 'out/', 'node_modules/', '.claude/', 'test-results/', 'playwright-report/']),
  tseslint.configs.recommended,
  {
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    // Gameplay numbers belong in src/sim/data/ (authored map data in src/sim/world/map/data/, D-BUILD-009); client
    // presentation numbers in named constants (D-EP-009).
    files: ['src/**/*.ts'],
    ignores: ['src/sim/data/**', 'src/sim/world/map/data/**', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': ['warn', {
        ignore: [-1, 0, 1, 2],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        ignoreEnums: true,
        ignoreNumericLiteralTypes: true,
        ignoreReadonlyClassProperties: true,
        ignoreTypeIndexes: true,
      }],
    },
  },
  {
    // The sim is pure and deterministic: no rendering, no client code, no clocks, no unseeded randomness.
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { regex: '^three(/|$)', message: 'src/sim must not import Three.js; rendering lives in src/client.' },
        { regex: '(^|/)client(/|$)', message: 'src/sim must not import from src/client.' },
      ] }],
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG from src/sim/core.' },
        { object: 'Date', property: 'now', message: 'Use the sim tick, not the wall clock.' },
        { object: 'performance', property: 'now', message: 'Use the sim tick, not the wall clock.' },
      ],
      'no-restricted-syntax': ['error',
        { selector: "NewExpression[callee.name='Date']", message: 'Use the sim tick, not the wall clock.' },
      ],
      'no-restricted-globals': ['error',
        { name: 'window', message: 'src/sim runs in Node; no DOM.' },
        { name: 'document', message: 'src/sim runs in Node; no DOM.' },
      ],
    },
  },
);
