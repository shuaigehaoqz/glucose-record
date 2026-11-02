import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pub = path.join(root, 'public')
await mkdir(pub, { recursive: true })

const BODY = `
  <path d="M256 118 C256 118 158 232 158 318 a98 98 0 0 0 196 0 C354 232 256 118 256 118 Z" fill="#ffffff"/>
  <path d="M190 320 h34 l20 -40 l30 78 l22 -46 h46"
        fill="none" stroke="#0b4f4a" stroke-width="19"
        stroke-linecap="round" stroke-linejoin="round"/>
`

function iconSvg({ radius = 0, droplet = 1 }) {
  const g =
    droplet === 1
      ? BODY
      : `<g transform="translate(256 256) scale(${droplet}) translate(-256 -256)">${BODY}</g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f766e"/>
      <stop offset="1" stop-color="#14b8a6"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  ${g}
</svg>`
}

const rounded = iconSvg({ radius: 112, droplet: 0.82 })
const flat = iconSvg({ radius: 0, droplet: 0.72 })
const maskable = iconSvg({ radius: 0, droplet: 0.62 })

async function png(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(pub, file))
}

await Promise.all([
  png(rounded, 192, 'pwa-192x192.png'),
  png(rounded, 512, 'pwa-512x512.png'),
  png(maskable, 512, 'pwa-512x512-maskable.png'),
  png(flat, 180, 'apple-touch-icon.png'),
  writeFile(path.join(pub, 'favicon.svg'), iconSvg({ radius: 64, droplet: 0.82 })),
])

console.log('图标已生成：', (await import('node:fs')).readdirSync(pub).join(', '))
