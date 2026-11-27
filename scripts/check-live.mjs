import { chromium } from 'playwright'

const URL = 'https://louskyfly.github.io/studio/'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`CONSOLE: ${m.text()}`))
page.on('requestfailed', (r) => {
  if (!r.url().includes('googleapis') && !r.url().includes('wikimedia')) errors.push(`REQ: ${r.url()} ${r.failure()?.errorText}`)
})

const res = {}
const response = await page.goto(URL, { waitUntil: 'networkidle' })
res.status = response?.status()
await page.waitForTimeout(2000)
res.title = await page.title()
res.heading = await page.locator('h1').first().textContent()
await page.screenshot({ path: 'shots/80-live-home.png', fullPage: true })

const cards = page.locator('article button.card')
res.cards = await cards.count()
if (res.cards) {
  await cards.first().click()
  await page.waitForTimeout(1800)
  res.editor = (await page.getByText('Diapositives').count()) > 0
  res.slides = await page.locator('[draggable="true"]').count()
  await page.screenshot({ path: 'shots/81-live-editor.png' })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  res.persisted = (await page.locator('article button.card').count()) > 0
}

res.manifest = await page.evaluate(async () => {
  const r = await fetch('./manifest.webmanifest')
  const j = await r.json()
  return { status: r.status, name: j.name }
})
res.sw = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'unsupported'
  const reg = await Promise.race([navigator.serviceWorker.ready.then(() => 'ready'), new Promise((r) => setTimeout(() => r('timeout'), 15000))])
  return reg
})

console.log(JSON.stringify({ errors, res }, null, 2))
await browser.close()
