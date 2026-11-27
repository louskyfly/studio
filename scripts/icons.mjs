import { chromium } from 'playwright'
import fs from 'node:fs'

fs.mkdirSync('public/icons', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()

const svg = fs.readFileSync('public/favicon.svg', 'utf8')
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  )
  await page.screenshot({ path: `public/icons/icon-${size}.png`, omitBackground: true })
}
await browser.close()
console.log('icons ok')
