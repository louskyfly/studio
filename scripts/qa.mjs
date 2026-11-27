import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto('http://127.0.0.1:5173/#/new/topic', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.screenshot({ path: 'shots/20-wizard.png', fullPage: true })

await page.goto('http://127.0.0.1:5173/#/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.screenshot({ path: 'shots/21-settings.png', fullPage: true })

await page.goto('http://127.0.0.1:5173/#/', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await page.locator('article button.card').first().click()
await page.waitForTimeout(1300)
await page.locator('[draggable="true"]').nth(4).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: 'shots/22-map-fixed.png' })

await page.locator('[draggable="true"]').nth(5).click()
await page.waitForTimeout(1000)
await page.screenshot({ path: 'shots/23-chart.png' })

await page.locator('[draggable="true"]').nth(2).click()
await page.waitForTimeout(800)
await page.screenshot({ path: 'shots/24-bullets.png' })

console.log(JSON.stringify({ errors }))
await browser.close()
