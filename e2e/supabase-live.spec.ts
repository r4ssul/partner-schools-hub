import { expect, test } from '@playwright/test'

const live = process.env.E2E_LIVE_SUPABASE === '1'
const ownerEmail = process.env.E2E_OWNER_EMAIL ?? ''
const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? ''
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? ''
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? ''

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /Sign in/ }).click()
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible()
}

test.describe('provisioned Supabase workspace', () => {
  test.skip(!live || !ownerEmail || !ownerPassword, 'Set the documented E2E_LIVE_SUPABASE owner credentials after building with Supabase variables.')

  test('owner login and password-recovery request', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill(ownerEmail)
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await expect(page.getByText(/reset email is on its way/i)).toBeVisible()
    await page.getByLabel('Password', { exact: true }).fill(ownerPassword)
    await page.getByRole('button', { name: /Sign in/ }).click()
    await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible()
  })

  test('invitation acceptance sets the invited password', async ({ page }) => {
    const inviteUrl = process.env.E2E_INVITE_URL
    const invitedPassword = process.env.E2E_INVITED_PASSWORD
    test.skip(!inviteUrl || !invitedPassword, 'Provide a fresh Supabase invitation URL and password.')
    await page.goto(inviteUrl!)
    await page.getByLabel('New password').fill(invitedPassword!)
    await page.getByLabel('Confirm password').fill(invitedPassword!)
    await page.getByRole('button', { name: /Activate account|Save password/ }).click()
    await expect(page.getByRole('heading', { name: /Account activated|Password updated/ })).toBeVisible()
  })

  test('two authenticated sessions receive a shared task without refresh', async ({ browser }) => {
    test.skip(!adminEmail || !adminPassword, 'Provide a second active workspace administrator.')
    const ownerContext = await browser.newContext()
    const adminContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    const adminPage = await adminContext.newPage()
    await signIn(ownerPage, ownerEmail, ownerPassword)
    await signIn(adminPage, adminEmail, adminPassword)
    await adminPage.getByRole('link', { name: 'Tasks', exact: true }).first().click()
    await ownerPage.getByRole('button', { name: /Add new/ }).click()
    await ownerPage.getByRole('menuitem', { name: 'New task' }).click()
    const title = `Realtime task ${Date.now()}`
    await ownerPage.getByLabel('Title').fill(title)
    await ownerPage.getByRole('button', { name: 'Create task' }).click()
    await expect(adminPage.getByText(title)).toBeVisible({ timeout: 15_000 })
    await ownerContext.close()
    await adminContext.close()
  })
})
