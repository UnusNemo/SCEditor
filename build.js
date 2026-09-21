import * as esbuild from 'esbuild';
import less from 'less';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

const isWatch = process.argv.includes('--watch');

async function compileLessThemes() {
  const themeDir = resolve('src/themes');
  const outDir = resolve('minified/themes');
  mkdirSync(outDir, { recursive: true });

  const files = readdirSync(themeDir).filter((file) => file.endsWith('.less'));

  for (const file of files) {
    const rawLess = readFileSync(join(themeDir, file), 'utf8');
    const outName = file.replace('.less', '.min.css');

    try {
      const output = await less.render(rawLess, {
        paths: [themeDir],
        compress: true,
      });
      writeFileSync(join(outDir, outName), output.css);
    } catch (err) {
      console.error(`Error compiling theme ${file}:`, err);
    }
  }
}

async function run() {
  const commonConfig = {
    bundle: true,
    minify: true,
    sourcemap: true,
    platform: 'browser',
    mainFields: ['browser', 'module', 'main'],
  };

  // 1. Core library: UMD/IIFE global (window.sceditor) + modern ESM module
  const coreCtx = await esbuild.context({
    ...commonConfig,
    entryPoints: ['src/sceditor.js'],
    outfile: 'minified/sceditor.min.js',
    format: 'iife',    
  });

  const esmCtx = await esbuild.context({
    ...commonConfig,
    entryPoints: ['src/sceditor.js'],
    outfile: 'minified/sceditor.esm.js',
    format: 'esm',
    mainFields: ['module', 'main'],
  });

  // 2. Format plugins (BBCode, XHTML, etc.)
  const formatEntries = readdirSync('src/formats')
    .filter((f) => f.endsWith('.js'))
    .map((f) => `src/formats/${f}`);

  const formatCtx = await esbuild.context({
    ...commonConfig,
    entryPoints: formatEntries,
    outdir: 'minified/formats',
    format: 'iife',
  });

  // 3. Compile themes
  await compileLessThemes();

  if (isWatch) {
    console.log('⚡ Watching for changes with esbuild...');
    await Promise.all([coreCtx.watch(), esmCtx.watch(), formatCtx.watch()]);
  } else {
    console.log('⚡ Building with esbuild...');
    await Promise.all([coreCtx.rebuild(), esmCtx.rebuild(), formatCtx.rebuild()]);
    await Promise.all([coreCtx.dispose(), esmCtx.dispose(), formatCtx.dispose()]);
    console.log('✅ Build complete in minified/');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
