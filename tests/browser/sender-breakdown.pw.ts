import { expect, test, type Page } from '@playwright/test'

async function importConversation(page: Page) {
  const participants = ['Me', 'Peer', 'Third']
  const senders = ['Me', 'Peer', 'Me', 'Third', 'Peer', 'Me']
  await page.getByLabel('Choose Instagram files', { exact: true }).setInputFiles({
    name: 'message_1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      title: 'Sender visibility regression',
      participants: participants.map((name) => ({ name })),
      messages: senders.map((sender_name, index) => ({
        sender_name,
        content: `Fixture message ${index}`,
        timestamp_ms: Date.UTC(2026, 0, 1, 12, index),
      })),
    })),
  })
  await page.getByRole('button', { name: 'Import chats', exact: true }).click()
  await page.getByRole('button', { name: 'View conversations', exact: true }).click()
}

test('sender counts and rings survive social filters, grouping changes, and cached reloads', async ({ page }) => {
  await page.goto('/')
  await importConversation(page)
  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Messages by sender', exact: true }) })
  const mode = panel.getByRole('combobox', { name: 'Sender share display' })
  await expect(panel.getByRole('heading', { name: 'Me', exact: true })).toBeVisible()

  // Fanboy's Social Blocking List contains the generic rule ##.share-row.
  // Apply its cosmetic effect without requiring a browser extension in CI.
  // https://easylist.to/easylist/fanboy-social.txt
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.share-row { display: none !important; }'
      document.head.append(style)
    })
  })
  await page.addStyleTag({ content: '.share-row { display: none !important; }' })
  await expect(panel.getByRole('heading', { name: 'Me', exact: true })).toBeVisible()

  await mode.selectOption('sides')
  await expect(panel.getByRole('heading', { name: 'You', exact: true })).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Others', exact: true })).toBeVisible()
  await expect(panel.getByText('3 messages', { exact: true })).toHaveCount(2)
  await expect(panel.getByRole('img', { name: 'You’s message share: 50.0%', exact: true })).toBeVisible()
  await expect(panel.getByRole('img', { name: 'Others’s message share: 50.0%', exact: true })).toBeVisible()

  await mode.selectOption('participants')
  for (const [sender, count, percentage] of [['Me', 3, '50.0'], ['Peer', 2, '33.3'], ['Third', 1, '16.7']] as const) {
    await expect(panel.getByRole('heading', { name: sender, exact: true })).toBeVisible()
    await expect(panel.getByText(`${count} messages`, { exact: true })).toBeVisible()
    await expect(panel.getByRole('img', { name: `${sender}’s message share: ${percentage}%`, exact: true })).toBeVisible()
  }
  await mode.selectOption('auto')
  await expect(panel.getByRole('heading', { name: 'Me', exact: true })).toBeVisible()
  await page.reload()
  await expect(mode).toHaveValue('auto')
  await expect(panel.getByRole('heading', { name: 'Me', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await expect(panel).toHaveCount(0)
  await page.getByRole('tab', { name: 'Overview', exact: true }).click()
  await expect(panel.getByRole('heading', { name: 'Me', exact: true })).toBeVisible()
  const canvases = panel.locator('canvas')
  await expect(canvases).toHaveCount(3)
  for (const canvas of await canvases.all()) {
    await expect(canvas).toBeVisible()
    expect(await canvas.evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) return false
      const context = element.getContext('2d')!
      return context.getImageData(0, 0, element.width, element.height).data.some((value) => value !== 0)
    })).toBe(true)
  }
})
