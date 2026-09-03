import { expect, test } from '@playwright/test'

const STORAGE_KEY = 'partner-schools-hub:workspace:v3'
const PREVIEW_EMAIL = 'mcanbaloglu@enishi.ac.jp'
const PREVIEW_PASSWORD = 'partner-schools-e2e-only'

async function mainNavLink(page: import('@playwright/test').Page, name: string) {
  const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' })
  return (page.viewportSize()?.width ?? 1000) <= 640
    ? mobileNav.getByRole('link', { name, exact: true })
    : page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name, exact: true })
}

async function resetWorkspace(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate((keys) => {
    keys.forEach((key) => localStorage.removeItem(key))
    localStorage.removeItem('company-hub:workspace:v1')
    localStorage.removeItem('partner-schools-hub:chat:preview')
    sessionStorage.removeItem('partner-schools-hub:preview-session')
  }, [STORAGE_KEY, 'partner-schools-hub:workspace:v2'])
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.getByLabel('Email address').fill(PREVIEW_EMAIL)
  await page.getByLabel('Password', { exact: true }).fill(PREVIEW_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Good morning, Jan' })).toBeVisible()
}

async function uploadFixture(page: import('@playwright/test').Page) {
  await (await mainNavLink(page, 'Files')).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Upload file' }).first().click()
  await (await chooser).setFiles('e2e/fixtures/sample.txt')
  await expect(page.getByText('sample.txt uploaded successfully.')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await resetWorkspace(page)
})

test('starts with Jan as Super Admin and Rassul as Owner', async ({ page }) => {
  await page.locator('.user-button').click()
  await expect(page.locator('.user-button')).toContainText('Jan Baloglu')
  await expect(page.locator('.user-button')).toContainText('Super Admin')
  await page.getByRole('menuitem', { name: 'Manage users' }).click()
  const members = page.locator('.member-row')
  await expect(members).toHaveCount(2)
  await expect(members.first()).toContainText('Jan Baloglu')
  await expect(members.first()).toContainText('Super Admin')
  await expect(members.last()).toContainText('Rassul Abzhapparov')
  await expect(members.last()).toContainText('Owner')
})

test('protects the portal with login and rejects invalid credentials', async ({ page }) => {
  await page.locator('.user-button').click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Email address').fill(PREVIEW_EMAIL)
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
  await page.getByLabel('Password', { exact: true }).fill(PREVIEW_PASSWORD)
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Good morning, Jan' })).toBeVisible()
})

test('renders the approved home hierarchy and empty production states', async ({ page }) => {
  for (const title of ['Coming up', 'Files & knowledge', 'Quick links', 'Team calendar', 'Meetings', 'My tasks', 'Secure access']) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  }
  for (const emptyCopy of ['No events yet', 'No files yet', 'No links yet', 'Calendar is clear', 'No meetings yet', 'No tasks yet']) {
    await expect(page.getByText(emptyCopy, { exact: true })).toBeVisible()
  }
  await (await mainNavLink(page, 'Tasks')).click()
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
  await (await mainNavLink(page, 'Files')).click()
  await expect(page.getByRole('heading', { name: 'Files & knowledge' })).toBeVisible()
})

test('provides discoverable search, functional dashboard tabs, and keyboard-safe creation', async ({ page }) => {
  if ((page.viewportSize()?.width ?? 1000) > 640) {
    await page.getByRole('button', { name: 'Search Partner Schools Hub' }).click()
  } else {
    await page.keyboard.press('Control+K')
  }
  await expect(page.getByRole('dialog', { name: 'Search Partner Schools Hub' })).toBeVisible()
  await expect(page.getByLabel('Search all workspace content')).toBeFocused()
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: 'Tasks (0)' }).click()
  await expect(page.getByText('No open tasks', { exact: true })).toBeVisible()
  if ((page.viewportSize()?.width ?? 1000) > 640) {
    await page.getByRole('tab', { name: 'Minutes' }).click()
    await expect(page.getByText('No minutes yet', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Action items' }).click()
    await expect(page.getByText('No action items', { exact: true })).toBeVisible()
  }

  const addButton = page.getByRole('button', { name: 'Add new' })
  await addButton.click()
  const taskChoice = page.getByRole('menuitem', { name: 'New task' })
  if (await taskChoice.isVisible().catch(() => false)) await taskChoice.click()
  await expect(page.getByPlaceholder('What needs to be done?')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(addButton).toBeFocused()
})

test('saves notification preferences independently', async ({ page }) => {
  await page.goto('/settings')
  const emailToggle = page.getByRole('checkbox', { name: 'Email notifications' })
  await emailToggle.uncheck()
  await page.getByRole('button', { name: 'Save notifications' }).click()
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').settings?.emailNotifications, STORAGE_KEY)).toBe(false)
})

test('creates and completes a team task', async ({ page }) => {
  await page.getByRole('button', { name: /Add new/ }).click()
  const newTaskChoice = page.getByRole('menuitem', { name: 'New task' })
  if (await newTaskChoice.isVisible().catch(() => false)) await newTaskChoice.click()
  await page.getByLabel('Title').fill('Confirm launch checklist')
  await page.getByRole('button', { name: 'Create task' }).click()
  await (await mainNavLink(page, 'Tasks')).click()
  await expect(page.getByText('Confirm launch checklist')).toBeVisible()
  await page.getByRole('button', { name: 'Complete Confirm launch checklist' }).click()
  await expect(page.getByRole('button', { name: 'Reopen Confirm launch checklist' })).toBeVisible()
})

test('uploads a supported file into the clean workspace', async ({ page }) => {
  await uploadFixture(page)
  await expect(page.getByText('sample.txt').first()).toBeVisible()
})

test('creates, trashes, and restores a folder', async ({ page }) => {
  await (await mainNavLink(page, 'Files')).click()
  await page.getByRole('button', { name: 'New folder' }).last().click()
  await page.getByLabel('Folder name').fill('Leadership resources')
  await page.getByRole('button', { name: 'Create folder' }).click()
  const folder = page.locator('.folder-item').filter({ hasText: 'Leadership resources' })
  await expect(folder).toBeVisible()
  await folder.getByRole('button', { name: 'Delete folder Leadership resources' }).click()
  await expect(page.getByRole('dialog', { name: 'Move folder to trash?' })).toBeVisible()
  await page.getByRole('button', { name: 'Move to trash' }).click()
  await expect(page.getByRole('status')).toContainText('Leadership resources moved to trash')

  await page.locator('.user-button').click()
  await page.getByRole('menuitem', { name: 'Trash', exact: true }).click()
  const trashed = page.locator('.trash-list > div').filter({ hasText: 'Leadership resources' })
  await expect(trashed).toContainText('folder')
  await trashed.getByRole('button', { name: 'Restore' }).click()
  await (await mainNavLink(page, 'Files')).click()
  await expect(page.locator('.folder-item').filter({ hasText: 'Leadership resources' })).toBeVisible()
})

test('creates a shared event with Jan and a linked document', async ({ page }) => {
  await uploadFixture(page)
  await (await mainNavLink(page, 'Calendar')).click()
  await page.getByRole('button', { name: 'New event' }).click()
  await page.getByLabel('Title').fill('Partner schools planning review')
  await page.getByLabel('Location or call link').fill('Online meeting')
  await page.getByRole('checkbox', { name: /Jan Baloglu/ }).check()
  await page.getByRole('checkbox', { name: 'sample.txt' }).check()
  await page.getByRole('button', { name: 'Create event' }).click()
  await expect(page.getByText('Partner schools planning review').first()).toBeVisible()
  await expect.poll(async () => page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    const event = data.events?.find((item: { title: string }) => item.title === 'Partner schools planning review')
    return { attendees: event?.attendeeIds?.length, documents: event?.documentIds?.length }
  }, STORAGE_KEY)).toEqual({ attendees: 1, documents: 1 })
})

test('turns a newly created meeting action item into a source-linked task', async ({ page }) => {
  await (await mainNavLink(page, 'Meetings')).click()
  await page.getByRole('button', { name: 'New meeting' }).click()
  await page.getByLabel('Title').fill('Heads of School meeting')
  await page.getByRole('button', { name: 'Create meeting' }).click()
  await page.getByRole('button', { name: 'Add action item' }).click()
  await page.getByLabel('Title').fill('Share the agreed action points')
  await page.getByRole('button', { name: 'Create task' }).click()
  await (await mainNavLink(page, 'Tasks')).click()
  await expect(page.getByText('Share the agreed action points')).toBeVisible()
  await expect.poll(async () => page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    const task = data.tasks?.find((item: { title: string }) => item.title === 'Share the agreed action points')
    const meeting = data.meetings?.find((item: { id: string }) => item.id === task?.sourceMeetingId)
    return meeting?.title
  }, STORAGE_KEY)).toBe('Heads of School meeting')
})

test('uploads an immutable second file version', async ({ page }) => {
  await uploadFixture(page)
  await page.getByRole('button', { name: 'Details for sample.txt' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Upload new version' }).click()
  await (await chooser).setFiles('e2e/fixtures/sample-v2.txt')
  await expect(page.getByText('Version 2 uploaded.')).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.getByText('sample-v2.txt').first()).toBeVisible()
  await expect(page.getByText('Version 2').first()).toBeVisible()
})

test('searches newly created workspace content and starts with no notifications', async ({ page }) => {
  await page.getByRole('button', { name: /Add new/ }).click()
  const newLinkChoice = page.getByRole('menuitem', { name: 'New link' })
  if (await newLinkChoice.isVisible().catch(() => false)) await newLinkChoice.click()
  else await page.getByRole('button', { name: 'Quick link', exact: true }).click()
  await page.getByLabel('Title').fill('Partner Schools handbook')
  await page.getByLabel('URL').fill('https://example.com/handbook')
  await page.getByRole('button', { name: 'Create link' }).click()
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })))
  const search = page.getByRole('dialog', { name: 'Search Partner Schools Hub' })
  await search.getByPlaceholder(/Search files/).fill('Partner Schools handbook')
  await search.getByRole('button', { name: /Partner Schools handbook/ }).click()
  await expect(page.getByRole('heading', { name: 'Quick links' })).toBeVisible()
  await expect(page.getByRole('button', { name: '0 unread notifications' })).toBeVisible()
})

test('super admin previews, invites, and deactivates an admin', async ({ page }) => {
  await page.locator('.user-button').click()
  await page.getByRole('menuitem', { name: 'Manage users' }).click()
  await page.getByRole('button', { name: 'Invite team member' }).click()
  await page.getByLabel('Full name').fill('Casey Nguyen')
  await page.getByLabel('Work email').fill('casey@example.com')
  await page.getByLabel('Organisation').fill('Shinagawa International School')
  await page.getByLabel('Job title').fill('Programme Coordinator')
  await expect(page.getByLabel('Invitation email summary')).toContainText('Jan Baloglu')
  await expect(page.getByLabel('Invitation email summary')).toContainText('Admin')
  await page.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByRole('status')).toContainText('Invitation sent to casey@example.com')
  const member = page.locator('.member-row').filter({ hasText: 'Casey Nguyen' })
  await expect(member).toContainText('Shinagawa International School · Programme Coordinator')
  await expect(member).toContainText('Admin')
  await member.getByRole('button', { name: 'Deactivate' }).click()
  await expect(page.getByRole('status')).toContainText('Casey Nguyen was deactivated')
  await expect(member).toContainText('Deactivated')
})

test('owner can review the two audit scopes with guarded clear actions', async ({ page }) => {
  // Isolated preview fixture: make the signed-in test identity Owner.
  await page.evaluate((key) => { const value = JSON.parse(localStorage.getItem(key) || '{}'); value.members[0].role = 'owner'; localStorage.setItem(key, JSON.stringify(value)) }, STORAGE_KEY)
  await page.reload()
  await page.locator('.user-button').click()
  await page.getByRole('menuitem', { name: 'Audit log' }).click()
  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible()
  await page.getByRole('button', { name: 'Members' }).click()
  await expect(page.getByRole('heading', { name: 'Member log' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear member log' }).click()
  const dialog = page.getByRole('dialog', { name: 'Clear member log?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Clear permanently' })).toBeDisabled()
  await dialog.getByLabel('Confirmation').fill('CLEAR')
  await expect(dialog.getByRole('button', { name: 'Clear permanently' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

test('lets the signed-in administrator control personal information', async ({ page }) => {
  await page.goto('/settings')
  await page.getByLabel('Organisation').fill('Horizon Partner School')
  await page.getByLabel('Job title').fill('Executive Director')
  await page.getByLabel('Phone number').fill('+81 3 5555 0123')
  await page.getByRole('button', { name: 'Save personal information' }).click()
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()
  await expect.poll(async () => page.evaluate((key) => {
    const member = JSON.parse(localStorage.getItem(key) || '{}').members?.[0]
    return { organization: member?.organization, jobTitle: member?.jobTitle, phone: member?.phone }
  }, STORAGE_KEY)).toEqual({ organization: 'Horizon Partner School', jobTitle: 'Executive Director', phone: '+81 3 5555 0123' })

  await page.locator('.user-button').click()
  await page.getByRole('menuitem', { name: 'Manage users' }).click()
  await expect(page.locator('.member-row').filter({ hasText: 'Jan Baloglu' })).toContainText('Horizon Partner School · Executive Director')
})

test('moves newly created content to trash and restores it', async ({ page }) => {
  await page.getByRole('button', { name: /Add new/ }).click()
  const newTaskChoice = page.getByRole('menuitem', { name: 'New task' })
  if (await newTaskChoice.isVisible().catch(() => false)) await newTaskChoice.click()
  await page.getByLabel('Title').fill('Temporary retention check')
  await page.getByRole('button', { name: 'Create task' }).click()
  await (await mainNavLink(page, 'Tasks')).click()
  await page.getByRole('button', { name: 'Move Temporary retention check to trash' }).click()
  await page.locator('.user-button').click()
  await page.getByRole('menuitem', { name: 'Trash', exact: true }).click()
  const deleted = page.locator('.trash-list > div').filter({ hasText: 'Temporary retention check' })
  await expect(deleted).toBeVisible()
  await deleted.getByRole('button', { name: 'Restore' }).click()
  await (await mainNavLink(page, 'Tasks')).click()
  await expect(page.getByText('Temporary retention check')).toBeVisible()
})

test('mobile layout has no horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile-only assertion')
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
})

test('super admin can manage settings but cannot clear either log', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByLabel('Workspace name')).toBeEnabled()
  await page.goto('/admin/audit')
  await expect(page.getByText('Only the Owner can clear activity and member logs.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Clear activity|Clear member log/ })).toHaveCount(0)
})

test('improved upload dialog saves without a hidden title requirement', async ({ page }) => {
  await page.getByRole('button', { name: /Add new/ }).click()
  const menu = page.getByRole('menuitem', { name: 'Upload file' })
  if (await menu.isVisible().catch(() => false)) await menu.click()
  else await page.getByRole('button', { name: 'Upload file', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add new' })
  await dialog.getByLabel('Choose file', { exact: true }).setInputFiles('e2e/fixtures/sample.txt')
  await dialog.getByLabel('Destination folder').selectOption('pyp')
  await dialog.locator('button[type="submit"]').click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('sample.txt').first()).toBeVisible()
})

test('creation dates validate and typing does not reset focus', async ({ page }) => {
  await page.goto('/calendar')
  await page.getByRole('button', { name: 'New event' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add new' })
  await dialog.getByLabel('Title').fill('Team planning')
  await dialog.getByLabel('Starts', { exact: true }).fill('2026-09-10T14:00')
  await dialog.getByLabel('Ends', { exact: true }).fill('2026-09-10T13:00')
  await dialog.getByRole('button', { name: 'Create event' }).click()
  await expect(dialog.getByText('End time must be after the start time')).toBeVisible()
  await dialog.getByLabel('Ends', { exact: true }).fill('2026-09-10T15:00')
  const location = dialog.getByLabel('Location or call link')
  await location.pressSequentially('Room A', { delay: 25 })
  await expect(location).toHaveValue('Room A')
  await expect(location).toBeFocused()
  await dialog.getByRole('button', { name: 'Create event' }).click()
  await expect(dialog).toBeHidden()
})

test('chat sends multiline messages, renders text safely, and persists on reload', async ({ page }) => {
  await (await mainNavLink(page, 'Chat')).click()
  await expect(page.getByRole('heading', { name: 'Team chat', level: 1 })).toBeVisible()
  const composer = page.getByRole('textbox', { name: 'Message your team' })
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()
  await composer.fill('Hello team')
  await composer.press('End')
  await composer.press('Shift+Enter')
  await composer.pressSequentially('Planning update <script>alert(1)</script>')
  await composer.press('Enter')
  await expect(page.locator('.chat-bubble')).toHaveText('Hello team\nPlanning update <script>alert(1)</script>')
  await expect(composer).toHaveValue('')
  await page.reload()
  await expect(page.locator('.chat-bubble')).toContainText('Hello team')
  await expect(page.locator('.chat-bubble script')).toHaveCount(0)
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
})

test('home chat preview opens the full conversation', async ({ page }) => {
  const panel = page.locator('.dashboard-chat')
  await panel.getByRole('textbox', { name: 'Message your team' }).fill('Quick update from Home')
  await panel.getByRole('button', { name: 'Send message' }).click()
  await expect(panel.locator('.chat-bubble')).toContainText('Quick update from Home')
  await panel.getByRole('link', { name: /Open chat/ }).click()
  await expect(page).toHaveURL(/\/chat$/)
  await expect(page.locator('.chat-bubble')).toContainText('Quick update from Home')
})
