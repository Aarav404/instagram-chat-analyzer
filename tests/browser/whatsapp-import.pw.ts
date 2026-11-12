import { expect, test } from '@playwright/test'

test('unnamed WhatsApp exports use contact names and update when your accounts change', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose WhatsApp files', { exact: true }).setInputFiles({
    name: '_chat.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('[29/04/26, 7:33:34\u202fAM] Alex: Hello\r\n\u200e[26/06/26, 10:47:18\u202fAM] Robin: Hi\r\n[26/06/26, 10:52:04\u202fAM] Alex: Thanks'),
  })
  await page.getByRole('button', { name: 'Import chats', exact: true }).click()
  await expect(page.getByText('1 conversations added or updated · 3 messages', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View conversations', exact: true }).click()
  await page.goto('/#conversations')
  await page.getByRole('button', { name: 'View Robin', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Robin', level: 1, exact: true })).toBeVisible()
  const chatURL = page.url()

  await page.getByRole('button', { name: 'Your accounts', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Robin', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Alex', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Alex', level: 1, exact: true })).toBeVisible()
  await expect(page).toHaveURL(chatURL)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Alex', level: 1, exact: true })).toBeVisible()

  // No selected owner: show both names rather than guess who exported the file.
  await page.getByRole('button', { name: 'Your accounts', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Robin', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Alex, Robin', level: 1, exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Alex, Robin', level: 1, exact: true })).toBeVisible()
  await expect(page.getByText('WhatsApp conversation', { exact: true })).toHaveCount(0)
})
