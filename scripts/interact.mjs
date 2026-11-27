import { chromium } from 'playwright'
import fs from 'node:fs'

const out = 'shots'
const errors = []
const results = {}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`)
})

const openDemo = async () => {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.locator('article button.card').first().click()
  await page.waitForTimeout(1300)
}

try {
  await openDemo()
  await page.locator('[draggable="true"]').nth(2).click()
  await page.waitForTimeout(700)

  // --- édition de texte ---
  const titleEl = page.locator('[data-canvas] [data-element-id]').filter({ hasText: 'Trois façons de commencer' }).first()
  await titleEl.dblclick()
  await page.waitForTimeout(500)
  const editable = page.locator('[data-canvas] [contenteditable="true"]').first()
  results.editableVisible = (await editable.count()) > 0
  if (results.editableVisible) {
    await editable.click({ position: { x: 220, y: 18 } })
    await page.keyboard.press('Control+A')
    await page.keyboard.type('Trois entrées possibles')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1400)
    results.textAfterEdit = await page.locator('[data-canvas] [data-element-id]').filter({ hasText: 'Trois entrées possibles' }).count()
    results.editingClosed = (await page.locator('[data-canvas] [contenteditable="true"]').count()) === 0
    await page.screenshot({ path: `${out}/12-text-edited.png` })
  }

  // --- déplacement ---
  const bodyEl = page.locator('[data-canvas] [data-element-id]').filter({ hasText: 'Le même éditeur' }).first()
  const box = await bodyEl.boundingBox()
  results.dragBefore = await bodyEl.getAttribute('style')
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 50, { steps: 14 })
    await page.mouse.up()
    await page.waitForTimeout(600)
  }
  results.dragAfter = await bodyEl.getAttribute('style')

  // --- annuler ---
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(700)
  results.afterUndo = await bodyEl.getAttribute('style')
  results.undoWorked = results.afterUndo === results.dragBefore

  // --- persistance ---
  await page.waitForTimeout(1300)
  await page.goto('http://127.0.0.1:5173/#/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.locator('article button.card').first().click()
  await page.waitForTimeout(1300)
  await page.locator('[draggable="true"]').nth(2).click()
  await page.waitForTimeout(700)
  results.persistedText = await page.locator('[data-canvas] [data-element-id]').filter({ hasText: 'Trois entrées possibles' }).count()

  // --- thème ---
  await page.getByRole('button', { name: /Design/ }).first().click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /Atlas/ }).first().click()
  await page.waitForTimeout(900)
  results.themeApplied = (await page.getByText('Thème « Atlas » appliqué').count()) > 0
  await page.screenshot({ path: `${out}/13-theme-atlas.png` })

  // --- ajouter une diapositive ---
  const slideCountBefore = await page.locator('[draggable="true"]').count()
  await page.getByRole('button', { name: 'Ajouter une diapositive' }).click()
  await page.waitForTimeout(500)
  const dialog = page.locator('[role="dialog"]').last()
  await dialog.locator('[data-layout="timeline"]').click()
  await page.waitForTimeout(800)
  results.slideAdded = (await page.locator('[draggable="true"]').count()) === slideCountBefore + 1
  await page.screenshot({ path: `${out}/14-slide-added.png` })

  // --- mode présentation ---
  await page.getByRole('button', { name: 'Présenter' }).first().click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/15-present.png` })
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(500)
  results.presentAdvanced = (await page.getByText(`2 / ${slideCountBefore + 1}`).count()) > 0
  await page.screenshot({ path: `${out}/16-present-2.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
} catch (err) {
  errors.push(`TEST: ${err.message}`)
  await page.screenshot({ path: `${out}/99-failure.png` }).catch(() => {})
} finally {
  fs.writeFileSync(`${out}/interactions.json`, JSON.stringify({ errors, results }, null, 2))
  console.log(JSON.stringify({ errors, results }, null, 2))
  await browser.close()
}
