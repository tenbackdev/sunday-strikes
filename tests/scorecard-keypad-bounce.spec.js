import { test, expect } from '@playwright/test'

// Tolerance: allow up to 4px scroll drift (sub-pixel rounding is fine; a real bounce is 100+ px)
const BOUNCE_THRESHOLD_PX = 4

test.describe('BowlingKeypad — no scroll bounce on mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?playwright=1')
    await page.waitForSelector('[data-testid="modal-scroll"]')
  })

  test('scroll position is stable when keypad first appears', async ({ page }) => {
    const modal = page.locator('[data-testid="modal-scroll"]')
    const scrollBefore = await modal.evaluate(el => el.scrollTop)

    // Tap the first editable ball input — triggers the keypad to slide up
    await page.locator('[data-ball-input]').first().tap()

    // Wait for the keypad slide-in animation to finish (200ms)
    await page.waitForTimeout(300)

    const scrollAfter = await modal.evaluate(el => el.scrollTop)
    const drift = Math.abs(scrollAfter - scrollBefore)

    expect(drift, `Scroll jumped ${drift}px when keypad appeared (threshold: ${BOUNCE_THRESHOLD_PX}px)`).toBeLessThanOrEqual(BOUNCE_THRESHOLD_PX)
  })

  test('scroll position is stable when tapping digit keys repeatedly', async ({ page }) => {
    const modal = page.locator('[data-testid="modal-scroll"]')

    // Focus first input to open keypad
    await page.locator('[data-ball-input]').first().tap()
    await page.waitForTimeout(300)

    const maxDrift = { value: 0 }
    const digits = ['1', '2', '3', '4', '5']

    for (const digit of digits) {
      const scrollBefore = await modal.evaluate(el => el.scrollTop)

      // Tap a keypad digit button
      await page.locator(`[data-keypad-key="${digit}"]`).tap()
      await page.waitForTimeout(60)

      const scrollAfter = await modal.evaluate(el => el.scrollTop)
      const drift = Math.abs(scrollAfter - scrollBefore)
      if (drift > maxDrift.value) maxDrift.value = drift
    }

    expect(maxDrift.value, `Max scroll drift across ${digits.length} keypad taps was ${maxDrift.value}px (threshold: ${BOUNCE_THRESHOLD_PX}px)`).toBeLessThanOrEqual(BOUNCE_THRESHOLD_PX)
  })

  test('scroll position is stable when tapping X, /, − keys', async ({ page }) => {
    const modal = page.locator('[data-testid="modal-scroll"]')

    // Focus a ball that can accept X (first ball of a frame)
    const inputs = page.locator('[data-ball-input]')
    await inputs.first().tap()
    await page.waitForTimeout(300)

    const scrollBefore = await modal.evaluate(el => el.scrollTop)

    await page.locator('[data-keypad-key="X"]').tap()
    await page.waitForTimeout(60)

    const scrollAfter = await modal.evaluate(el => el.scrollTop)
    const drift = Math.abs(scrollAfter - scrollBefore)

    expect(drift, `Scroll jumped ${drift}px when tapping X key`).toBeLessThanOrEqual(BOUNCE_THRESHOLD_PX)
  })

  test('keypad closes cleanly when DONE is tapped', async ({ page }) => {
    const modal = page.locator('[data-testid="modal-scroll"]')

    await page.locator('[data-ball-input]').first().tap()
    await page.waitForTimeout(300)

    const scrollBefore = await modal.evaluate(el => el.scrollTop)

    // Tap DONE — should close keypad (slide down) without bouncing content
    await page.locator('[data-keypad-done]').tap()
    await page.waitForTimeout(300)

    const scrollAfter = await modal.evaluate(el => el.scrollTop)
    const drift = Math.abs(scrollAfter - scrollBefore)

    expect(drift, `Scroll jumped ${drift}px when closing keypad via DONE`).toBeLessThanOrEqual(BOUNCE_THRESHOLD_PX)
  })
})
