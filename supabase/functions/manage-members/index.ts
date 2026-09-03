import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleOptions, json } from '../_shared/http.ts'

interface ManageMemberRequest {
  action: 'invite' | 'resend' | 'deactivate'
  workspaceId: number
  name?: string
  email?: string
  organization?: string
  jobTitle?: string
  role?: 'admin' | 'super_admin'
  userId?: string
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

  let body: ManageMemberRequest
  try { body = await request.json() } catch { return json({ error: 'Invalid request body' }, 400) }
  const { data: owner } = await admin.from('workspace_members').select('role,active').eq('workspace_id', body.workspaceId).eq('user_id', authData.user.id).single()
  if (!owner?.active || owner.role !== 'owner') return json({ error: 'Only the super administrator can manage access' }, 403)

  if (body.action === 'invite' || body.action === 'resend') {
    if (!body.email || !body.name || !body.organization) return json({ error: 'Name, email and organisation are required' }, 400)
    const name = body.name.trim()
    const email = body.email.trim()
    const organization = body.organization.trim()
    const jobTitle = body.jobTitle?.trim() || ''
    const role = body.role || 'admin'
    if (!['admin', 'super_admin'].includes(role)) return json({ error: 'Invalid invitation role' }, 400)
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
    const roleLabel = role === 'super_admin' ? 'Super Admin' : 'Admin'
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

  if (body.action === 'deactivate') {
    if (!body.userId) return json({ error: 'User ID is required' }, 400)
    const { data: target } = await admin.from('workspace_members').select('role,profiles(full_name)').eq('workspace_id', body.workspaceId).eq('user_id', body.userId).single()
    if (!target) return json({ error: 'Member not found' }, 404)
    if (target.role === 'owner') return json({ error: 'The super administrator cannot be deactivated' }, 400)
    const { error: updateError } = await admin.from('workspace_members').update({ active: false }).eq('workspace_id', body.workspaceId).eq('user_id', body.userId)
    if (updateError) return json({ error: updateError.message }, 400)
    await admin.auth.admin.updateUserById(body.userId, { ban_duration: '876000h' })
    const profile = Array.isArray(target.profiles) ? target.profiles[0] : target.profiles
    await admin.from('audit_log').insert({ workspace_id: body.workspaceId, actor_id: authData.user.id, action: 'deactivated', entity_kind: 'member', entity_id: body.userId, entity_name: profile?.full_name || 'Team member' })
    return json({ success: true })
  }

  return json({ error: 'Unsupported action' }, 400)
})
