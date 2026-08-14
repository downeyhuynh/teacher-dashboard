import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'))
const destRoot = join(root, 'public', 'pdfjs')

mkdirSync(destRoot, { recursive: true })
cpSync(join(pdfjsRoot, 'standard_fonts'), join(destRoot, 'standard_fonts'), {
  recursive: true,
})
cpSync(join(pdfjsRoot, 'cmaps'), join(destRoot, 'cmaps'), { recursive: true })

console.log('Copied pdfjs standard_fonts + cmaps to public/pdfjs')
