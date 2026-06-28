import { defineConfig } from 'tsup';

// Dual ESM + CJS build so the library works in both `import` and `require`
// backends. Type declarations are emitted alongside.
export default defineConfig({
  entry: ['src/index.ts', 'src/synthetic.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // No source maps in the published package: they would re-embed the full TS
  // source (the repo deliberately ships only the build) and nearly double size.
  sourcemap: false,
  target: 'node24',
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
