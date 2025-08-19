import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/extension.ts',
  ],
  format: ['esm'],
  sourcemap: true,
  shims: false,
  dts: false,
  external: [
    'vscode',
  ],
})
