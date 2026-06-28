import { defineConfig } from 'tsup';

// Dual ESM + CJS build so the library works in both `import` and `require`
// backends. Type declarations are emitted alongside.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
