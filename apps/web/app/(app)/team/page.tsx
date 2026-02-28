'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, UserPlus, Trash2, Mail, Shield, Clock, X, Edit2 } from 'lucide-react'
import { apiClient, type TeamMember, type TeamInvite } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
  admin: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  member: 'bg-slate-100 text-slate-600 hover:bg-slate-100',
  marketing: 'bg-green-100 text-green-700 hover:bg-green-100',
  branch_manager: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  marketing: 'Marketing',
  branch_manager: 'Branch Manager',
}

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge className={ROLE_STYLES[role] ?? 'bg-slate-100 text-slate-600 hover:bg-slate-100'}>
      {ROLE_LABELS[role] ?? role}
    </Badge>
  )
}

function canRemove(actorRole: string, targetRole: string): boolean {
  if (targetRole === 'owner') return false
  if (actorRole === 'owner') return true
  if (actorRole === 'admin' && ['member', 'marketing', 'branch_manager'].includes(targetRole)) return true
  return false
}

function canChangeRole(actorRole: string, targetRole: string): boolean {
  if (targetRole === 'owner') return false
  if (actorRole === 'owner') return true
  if (actorRole === 'admin' && ['member', 'marketing', 'branch_manager'].includes(targetRole)) return true
  return false
}

function isReadOnly(role: string): boolean {
  return ['member', 'marketing', 'branch_manager'].includes(role)
}

function canInvite(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

export default function TeamPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [sentInvite, setSentInvite] = useState<TeamInvite | null>(null)

  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  // Role change dialog state
  const [roleChangeTarget, setRoleChangeTarget] = useState<TeamMember | null>(null)
  const [roleChangeValue, setRoleChangeValue] = useState('')
  const [roleChangeLoading, setRoleChangeLoading] = useState(false)
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null)

  const { data: accountData } = useQuery({
    queryKey: ['account'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).accounts.me()
    },
  })

  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).team.list()
    },
  })

  const account = accountData?.data
  const currentUserClerkId = account?.currentUser?.clerkId
  const currentUserRole = account?.currentUser?.role ?? 'member'
  const members: TeamMember[] = teamData?.data ?? []

  const { data: invitesData, isLoading: invitesLoading } = useQuery({
    queryKey: ['team-invites'],
    queryFn: async () => {
      const token = await getToken()
      return apiClient(token!).team.listInvites()
    },
    enabled: canInvite(currentUserRole),
  })

  const pendingInvites: TeamInvite[] = invitesData?.data ?? []

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteError(null)
    setSentInvite(null)
    try {
      const token = await getToken()
      const { data } = await apiClient(token!).team.invite({ email: inviteEmail.trim(), role: inviteRole })
      setSentInvite(data)
      setInviteEmail('')
      setInviteRole('member')
      await queryClient.invalidateQueries({ queryKey: ['team'] })
      await queryClient.invalidateQueries({ queryKey: ['team-invites'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send invite'
      setInviteError(message)
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleRevokeInvite(id: string) {
    try {
      const token = await getToken()
      await apiClient(token!).team.revokeInvite(id)
      await queryClient.invalidateQueries({ queryKey: ['team-invites'] })
    } catch {
      // silently ignore — user can retry
    }
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) return
    setRemoveLoading(true)
    setRemoveError(null)
    try {
      const token = await getToken()
      await apiClient(token!).team.remove(removeTarget.id)
      setRemoveTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['team'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member'
      setRemoveError(message)
    } finally {
      setRemoveLoading(false)
    }
  }

  async function handleRoleChangeSave() {
    if (!roleChangeTarget || !roleChangeValue) return
    setRoleChangeLoading(true)
    setRoleChangeError(null)
    try {
      const token = await getToken()
      await apiClient(token!).team.updateRole(roleChangeTarget.id, roleChangeValue)
      setRoleChangeTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['team'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change role'
      setRoleChangeError(message)
    } finally {
      setRoleChangeLoading(false)
    }
  }

  const inviteLink = sentInvite
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${sentInvite.token}`
    : null

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-slate-100 rounded-lg">
          <Users className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500">Manage your account members and invitations</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Invite form — only for owner / admin */}
        {canInvite(currentUserRole) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4 text-slate-500" />
                Invite team member
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="invite-email" className="sr-only">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="w-full sm:w-44">
                  <Label htmlFor="invite-role" className="sr-only">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger id="invite-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="branch_manager">Branch Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" disabled={inviteLoading} className="shrink-0">
                  {inviteLoading ? 'Sending...' : 'Send Invite'}
                </Button>
              </form>

              {inviteError && (
                <p className="mt-3 text-sm text-red-600">{inviteError}</p>
              )}

              {sentInvite && inviteLink && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    Invite sent to {sentInvite.email}
                  </p>
                  <p className="text-xs text-green-700 mb-2">
                    Share this link with them directly:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white border border-green-200 rounded px-3 py-2 text-green-800 truncate">
                      {inviteLink}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-green-300 text-green-700 hover:bg-green-100"
                      onClick={() => navigator.clipboard.writeText(inviteLink)}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pending invites — only for owner / admin */}
        {canInvite(currentUserRole) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-slate-500" />
                Pending invites
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invitesLoading ? (
                <div className="divide-y divide-slate-100">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-4 rounded" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-28" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : pendingInvites.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-slate-500">
                  No pending invites
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{invite.email}</p>
                          <p className="text-xs text-slate-400">
                            Expires {new Date(invite.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <RoleBadge role={invite.role} />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleRevokeInvite(invite.id)}
                          title={`Revoke invite for ${invite.email}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Members list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-slate-500" />
              Members
              {!teamLoading && members.length > 0 && (
                <span className="ml-1 text-sm font-normal text-slate-400">({members.length})</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {teamLoading ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-44" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                No team members found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {members.map((member) => {
                  const isCurrentUser = member.clerkId === currentUserClerkId
                  const showRemove =
                    !isCurrentUser &&
                    !isReadOnly(currentUserRole) &&
                    canRemove(currentUserRole, member.role)
                  const showRoleChange =
                    !isCurrentUser &&
                    !isReadOnly(currentUserRole) &&
                    canChangeRole(currentUserRole, member.role)

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar placeholder */}
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-slate-600">
                            {(member.name ?? member.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {member.name ?? member.email}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-slate-400 font-normal">(you)</span>
                            )}
                          </p>
                          {member.name && (
                            <p className="text-xs text-slate-500 truncate">{member.email}</p>
                          )}
                          <p className="text-xs text-slate-400">
                            Joined {new Date(member.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <RoleBadge role={member.role} />
                        {showRoleChange && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => {
                              setRoleChangeError(null)
                              setRoleChangeValue(member.role)
                              setRoleChangeTarget(member)
                            }}
                            title={`Change role for ${member.name ?? member.email}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {showRemove ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setRemoveError(null)
                              setRemoveTarget(member)
                            }}
                            title={`Remove ${member.name ?? member.email}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          /* Keep layout stable when no remove button */
                          !showRoleChange && <div className="h-8 w-8" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Read-only notice for non-admin roles */}
        {isReadOnly(currentUserRole) && (
          <p className="text-sm text-slate-500 text-center">
            Only owners and admins can invite or remove team members.
          </p>
        )}
      </div>

      {/* Remove confirmation dialog */}
      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null)
            setRemoveError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove team member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to remove{' '}
            <span className="font-medium text-slate-900">
              {removeTarget?.name ?? removeTarget?.email}
            </span>{' '}
            from the team? They will lose access immediately.
          </p>
          {removeError && (
            <p className="text-sm text-red-600">{removeError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveTarget(null)
                setRemoveError(null)
              }}
              disabled={removeLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveConfirm}
              disabled={removeLoading}
            >
              {removeLoading ? 'Removing...' : 'Remove member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change role dialog */}
      <Dialog
        open={roleChangeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRoleChangeTarget(null)
            setRoleChangeError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Change role for{' '}
              <span className="font-medium text-slate-900">
                {roleChangeTarget?.name ?? roleChangeTarget?.email}
              </span>
            </p>
            <div>
              <Label htmlFor="role-change-select" className="sr-only">Role</Label>
              <Select value={roleChangeValue} onValueChange={setRoleChangeValue}>
                <SelectTrigger id="role-change-select">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="branch_manager">Branch Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {roleChangeError && (
              <p className="text-sm text-red-600">{roleChangeError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRoleChangeTarget(null)
                setRoleChangeError(null)
              }}
              disabled={roleChangeLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRoleChangeSave}
              disabled={roleChangeLoading || !roleChangeValue}
            >
              {roleChangeLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
