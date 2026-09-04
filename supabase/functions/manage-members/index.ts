import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleOptions, json } from '../_shared/http.ts'

interface ManageMemberRequest {
  action: 'invite' | 'resend' | 'deactivate' | 'delete'
  workspaceId: number
  name?: string
  email?: string
  organization?: string
  jobTitle?: string
  role?: 'admin'
  userId?: string
  confirmEmail?: string
}

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const projectUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!projectUrl || !publishableKey || !secretKey) return json({ error: 'Server is not configured' }, 500)

  const authorization = request.headers.get('Authorization') || ''
  const caller = createClient(projectUrl, publishableKey, { global: { headers: { Authorization: authorization } } })
  const admin = createClient(projectUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData, error: authError } = await caller.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401)
  const { data: setupComplete, error: setupError } = await caller.rpc('has_completed_password_setup')
  if (setupError || setupComplete !== true) return json({ error: 'Set your password before accessing the workspace' }, 403)

  let body: ManageMemberRequest
  try { body = await request.json() } catch { return json({ error: 'Invalid request body' }, 400) }
  if (!Number.isSafeInteger(body.workspaceId) || body.workspaceId <= 0) return json({ error: 'Invalid workspace' }, 400)
  const { data: owner } = await admin.from('workspace_members').select('role,active').eq('workspace_id', body.workspaceId).eq('user_id', authData.user.id).single()
  if (!owner?.active || !['owner', 'super_admin'].includes(owner.role)) return json({ error: 'Only Super Admins can manage access' }, 403)

  if (body.action === 'invite' || body.action === 'resend') {
    if (!body.email || !body.name || !body.organization) return json({ error: 'Name, email and organisation are required' }, 400)
    const name = body.name.trim()
    const email = body.email.trim()
    const organization = body.organization.trim()
    const jobTitle = body.jobTitle?.trim() || ''
    const role = body.role || 'admin'
    if (role !== 'admin') return json({ error: 'Invalid invitation role' }, 400)
    if (name.length < 2 || name.length > 120 || organization.length < 2 || organization.length > 120 || jobTitle.length > 120) {
      return json({ error: 'Invitation details are outside the allowed length' }, 400)
    }
    const appUrl = Deno.env.get('APP_URL') || 'http://127.0.0.1:5173'
    const [workspace, inviterProfile] = await Promise.all([
      admin.from('workspaces').select('name').eq('id', body.workspaceId).single(),
      admin.from('profiles').select('full_name,organization').eq('id', authData.user.id).single(),
    ])
    if (workspace.error) return json({ error: workspace.error.message }, 400)
    const inviterName = inviterProfile.data?.full_name || authData.user.email || 'A workspace owner'
    const inviterOrganization = inviterProfile.data?.organization || workspace.data.name
    const roleLabel = 'Admin'
    const { data: existing, error: existingError } = await admin.from('profiles').select('id').ilike('email', email.replace(/[\\%_]/g, '\\$&')).maybeSingle()
    if (existingError) return json({ error: 'Unable to check the existing account. Please try again.' }, 500)
    if (existing) {
      const { data: existingMember } = await admin.from('workspace_members').select('active').eq('workspace_id', body.workspaceId).eq('user_id', existing.id).maybeSingle()
      if (existingMember && !existingMember.active) return json({ error: 'This deactivated account still exists. Ask the Web. Developer to permanently delete it from Former members, then invite this email again.' }, 409)
      if (body.action === 'invite' && existingMember?.active) return json({ error: 'This email already belongs to a team member. They can sign in or use Forgot password.' }, 409)
    }
    const { data: invitation, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/accept-invite`,
      data: {
        full_name: name,
        organization,
        job_title: jobTitle,
        workspace_id: body.workspaceId,
        workspace_name: workspace.data.name,
        role,
        role_label: roleLabel,
        invited_by_name: inviterName,
        inviter_organization: inviterOrganization,
      },
    })
    if (error) return json({ error: error.message }, 400)
    if (!invitation.user) return json({ error: 'Invitation did not create a user' }, 500)
    await admin.from('profiles').upsert({ id: invitation.user.id, full_name: name, email, organization, job_title: jobTitle }, { onConflict: 'id' })
    const { error: membershipError } = await admin.from('workspace_members').upsert({ workspace_id: body.workspaceId, user_id: invitation.user.id, role, active: true }, { onConflict: 'workspace_id,user_id' })
    if (membershipError) return json({ error: membershipError.message }, 400)
    await admin.from('notification_preferences').upsert({ workspace_id: body.workspaceId, user_id: invitation.user.id, email_enabled: true }, { onConflict: 'workspace_id,user_id' })
    await admin.from('audit_log').insert({ workspace_id: body.workspaceId, actor_id: authData.user.id, action: 'invited', entity_kind: 'member', entity_id: invitation.user.id, entity_name: name, metadata: { organization, job_title: jobTitle, role } })
    return json({ userId: invitation.user.id, message: `Invitation sent from ${workspace.data.name}` })
  }

  if (body.action === 'delete') {
    if (!body.userId || !body.confirmEmail) return json({ error: 'Select a former member and confirm their email address.' }, 400)
    const { data: allowed, error: permissionError } = await caller.rpc('can_delete_former_member', { target_workspace_id: body.workspaceId, target_user_id: body.userId })
    if (permissionError || allowed !== true) return json({ error: 'Only the Web. Developer can permanently delete an inactive Admin account in this workspace. Active members and Super Admins are protected.' }, 403)
    const { data: target, error: targetError } = await admin.from('profiles').select('email,full_name').eq('id', body.userId).single()
    if (targetError || !target) return json({ error: 'Former member not found. Refresh the team list.' }, 404)
    if (body.confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) return json({ error: 'The confirmation email does not match this member.' }, 400)
    // Hard-delete Auth through its trusted API. FK actions preserve shared
    // content while removing profile, membership, sessions and private records.
    const { error: deleteError } = await admin.auth.admin.deleteUser(body.userId, false)
    if (deleteError) return json({ error: 'Account could not be deleted. It may own legacy storage objects or still have linked records. No shared files have been removed.' }, 409)
    const { error: auditError } = await admin.from('audit_log').insert({ workspace_id: body.workspaceId, actor_id: authData.user.id, action: 'permanently deleted', entity_kind: 'member', entity_id: body.userId, entity_name: target.full_name || 'Former member', metadata: { shared_content_preserved: true } })
    return json({ success: true, warning: auditError ? 'Account deleted, but the deletion audit entry could not be recorded.' : null })
  }

  if (body.action === 'deactivate') {
    if (!body.userId) return json({ error: 'User ID is required' }, 400)
    const { data: target } = await admin.from('workspace_members').select('role,profiles(full_name)').eq('workspace_id', body.workspaceId).eq('user_id', body.userId).single()
    if (!target) return json({ error: 'Member not found' }, 404)
    if (target.role !== 'admin') return json({ error: 'Super Admins cannot be deactivated' }, 400)
    const { error: updateError } = await admin.from('workspace_members').update({ active: false }).eq('workspace_id', body.workspaceId).eq('user_id', body.userId)
    if (updateError) return json({ error: updateError.message }, 400)
    await admin.auth.admin.updateUserById(body.userId, { ban_duration: '876000h' })
    const profile = Array.isArray(target.profiles) ? target.profiles[0] : target.profiles
    await admin.from('audit_log').insert({ workspace_id: body.workspaceId, actor_id: authData.user.id, action: 'deactivated', entity_kind: 'member', entity_id: body.userId, entity_name: profile?.full_name || 'Team member' })
    return json({ success: true })
  }

  return json({ error: 'Unsupported action' }, 400)
})
