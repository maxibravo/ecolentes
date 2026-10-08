/**
 * Mete el CSS y el JavaScript dentro del index.html para que la versión de
 * demostración sea un solo archivo, que se puede abrir o publicar en cualquier
 * lado sin depender de cómo se sirvan los archivos de al lado.
 *
 *   pnpm --filter @ecolentes/web demo
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error('Uso: node inline-demo.mjs <carpeta-del-build> <archivo-salida>');

let html = readFileSync(join(dir, 'index.html'), 'utf8');

for (const file of readdirSync(join(dir, 'assets'))) {
  const content = readFileSync(join(dir, 'assets', file), 'utf8');
  // Con una función de reemplazo, porque el bundle trae `$` y en un string de
  // reemplazo `$'` significa otra cosa y rompe el archivo.
  if (file.endsWith('.css')) {
    html = html.replace(
      new RegExp(`<link[^>]*href="[^"]*${file}"[^>]*>`),
      () => `<style>\n${content}\n</style>`,
    );
  } else if (file.endsWith('.js')) {
    html = html.replace(
      new RegExp(`<script[^>]*src="[^"]*${file}"[^>]*></script>`),
      () => `<script type="module">\n${content}\n</script>`,
    );
  }
}

if (html.includes('assets/')) throw new Error('Quedaron referencias a assets/ sin incrustar');

writeFileSync(out, html);
console.log(`Listo: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
