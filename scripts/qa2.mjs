import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const res = {}

await page.goto('http://127.0.0.1:5173/#/new/topic', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Page blanche' }).click()
await page.waitForURL(/\/#\/edit\//, { timeout: 20000 })
await page.waitForTimeout(1200)
res.blankSlides = await page.locator('[draggable="true"]').count()
res.blankHasTitle = (await page.getByText('Titre de la présentation').count()) > 0
await page.screenshot({ path: 'shots/50-blank.png' })

// recherche dans la bibliothèque
await page.goto('http://127.0.0.1:5173/#/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.goto('http://127.0.0.1:5173/#/library', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const cardsBefore = await page.locator('article').count()
await page.getByPlaceholder(/Rechercher un titre/).fill('romanisation')
await page.waitForTimeout(600)
const cardsAfter = await page.locator('article').count()
res.search = { cardsBefore, cardsAfter }
await page.screenshot({ path: 'shots/51-search.png' })

// dossier
await page.locator('[data-folder-id]').first().click()
await page.waitForTimeout(700)
res.folderView = (await page.getByText(/Dossier de la bibliothèque/).count()) > 0

console.log(JSON.stringify({ errors, res }, null, 2))
await browser.close()
