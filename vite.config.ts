import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
    // The entry document lives in `src`, the bundle is written to the repository
    // root. Both are named index.html, but they are in different directories, so
    // the build output never overwrites its own source.
    root: 'src',
    // Relative urls keep the bundle working below the project path of github pages.
    base: './',
    publicDir: '../public',
    build: {
        // Relative to `root`, therefore the repository root.
        outDir: '..',
        emptyOutDir: false,
        target: 'es2022'
    },
    plugins: [viteSingleFile()]
});
