import { chromium } from 'playwright'

const shotDir = 'C:\\Users\\Hp\\AppData\\Local\\Temp\\claude\\c--Users-Hp-Documents-Cacto-Test-Tower-Defense-Tower-Defense\\13d332d7-39ea-4bfa-969e-b82f12a7e9e8\\scratchpad'

const browser = await chromium.launch({ headless: false })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const errors = []
page.on('pageerror', (err) => errors.push(err.message))
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()) })

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.click('text=PERFORMANCE LAB')
await page.waitForTimeout(1000)
await page.screenshot({ path: `${shotDir}\\bug-01-canvas2d-lab.png` })

await page.click('text=WEBGL')
await page.waitForTimeout(2000)
await page.screenshot({ path: `${shotDir}\\bug-02-webgl-lab.png` })

console.log('ERRORS_AFTER_WEBGL', JSON.stringify(errors))

// wait longer to see if it's transient (font load) or persistent
await page.waitForTimeout(4000)
await page.screenshot({ path: `${shotDir}\\bug-03-webgl-lab-later.png` })

const html = await page.locator('aside').innerHTML()
console.log('ASIDE_HTML_LENGTH', html.length)

const boxes = await page.evaluate(() => {
  const spans = Array.from(document.querySelectorAll('aside .grid > div'))
  return spans.map(d => {
    const r = d.getBoundingClientRect()
    return { text: d.innerText, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  })
})
console.log('METRIC_BOXES', JSON.stringify(boxes, null, 2))

console.log('FINAL_ERRORS', JSON.stringify(errors))
await browser.close()
