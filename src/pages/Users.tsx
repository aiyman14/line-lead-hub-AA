import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Users as UsersIcon, Search, UserPlus, Shield, Mail, Phone, MoreHorizontal, Pencil, Trash2, Scissors, Package } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import { InviteUserDialog } from "@/components/users/InviteUserDialog";
import { EditUserDialog } from "@/components/users/EditUserDialog";
import { CleanupGlobalRolesDialog } from "@/components/users/CleanupGlobalRolesDialog";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  role: string | null;
  department: string | null;
  assigned_line_ids: string[];
  assigned_line_names: string[];
  created_at: string;
}

export default function UsersPage() {
  const { profile, isAdminOrHigher, user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchUsers();
    }
  }, [profile?.factory_id]);

  async function fetchUsers() {
    if (!profile?.factory_id) return;
    setLoading(true);

    try {
      // Fetch profiles, roles, lines, and line assignments in parallel
      const [profilesRes, rolesRes, linesRes, lineAssignmentsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('factory_id', profile.factory_id)
          .order('full_name'),
        supabase
          .from('user_roles')
          .select('user_id, role'),
        supabase
          .from('lines')
          .select('id, line_id, name')
          .eq('factory_id', profile.factory_id),
        supabase
          .from('user_line_assignments')
          .select('user_id, line_id')
          .eq('factory_id', profile.factory_id),
      ]);

      const roleMap = new Map<string, string>();
      rolesRes.data?.forEach(r => {
        const existingRole = roleMap.get(r.user_id);
        const roleOrder = ['superadmin', 'owner', 'admin', 'supervisor', 'worker'];
        if (!existingRole || roleOrder.indexOf(r.role) < roleOrder.indexOf(existingRole)) {
          roleMap.set(r.user_id, r.role);
        }
      });

      const lineMap = new Map<string, { line_id: string; name: string | null }>();
      linesRes.data?.forEach(l => lineMap.set(l.id, { line_id: l.line_id, name: l.name }));

      // Group line assignments by user
      const userLineAssignments = new Map<string, string[]>();
      lineAssignmentsRes.data?.forEach(la => {
        const existing = userLineAssignments.get(la.user_id) || [];
        existing.push(la.line_id);
        userLineAssignments.set(la.user_id, existing);
      });

      const formattedUsers: User[] = (profilesRes.data || []).map(p => {
        const lineIds = userLineAssignments.get(p.id) || [];
        const lineNames = lineIds.map(id => {
          const line = lineMap.get(id);
          return line?.name || line?.line_id || id;
        });

        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
          avatar_url: p.avatar_url,
          is_active: p.is_active,
          role: roleMap.get(p.id) || 'worker',
          department: p.department,
          assigned_line_ids: lineIds,
          assigned_line_names: lineNames,
          created_at: p.created_at,
        };
      });

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.role || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string | null) => {
    switch (role) {
      case 'owner':
      case 'superadmin':
        return 'primary';
      case 'admin':
        return 'info';
      case 'supervisor':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const activeUsers = users.filter(u => u.is_active);
  const adminCount = users.filter(u => ['admin', 'owner', 'superadmin'].includes(u.role || '')).length;

  function handleEditUser(user: User) {
    setSelectedUser(user);
    setShowEditDialog(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UsersIcon className="h-6 w-6" />
            Users
          </h1>
          <p className="text-muted-foreground">Manage factory users and roles</p>
        </div>
        {isAdminOrHigher() && (
          <div className="flex items-center gap-2">
            <CleanupGlobalRolesDialog onSuccess={fetchUsers} />
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{users.length}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-success">{activeUsers.length}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{adminCount}</p>
            <p className="text-sm text-muted-foreground">Admins</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Assigned Lines</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {isAdminOrHigher() && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {user.full_name}
                              {user.id === currentUser?.id && (
                                <span className="text-muted-foreground text-xs ml-2">(you)</span>
                              )}
                            </p>
                            {user.role === 'worker' && user.department && (
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  user.department === 'sewing' 
                                    ? 'border-blue-500/50 text-blue-600 bg-blue-50 dark:bg-blue-950/30' 
                                    : user.department === 'finishing'
                                    ? 'border-orange-500/50 text-orange-600 bg-orange-50 dark:bg-orange-950/30'
                                    : 'border-purple-500/50 text-purple-600 bg-purple-50 dark:bg-purple-950/30'
                                }`}
                              >
                                {user.department === 'sewing' && <Scissors className="h-3 w-3 mr-1" />}
                                {user.department === 'finishing' && <Package className="h-3 w-3 mr-1" />}
                                {user.department === 'both' && '⚡'}
                                {user.department === 'sewing' ? 'Sewing' : user.department === 'finishing' ? 'Finishing' : 'Both'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={getRoleBadgeVariant(user.role) as any} size="sm">
                        <Shield className="h-3 w-3 mr-1" />
                        {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || 'Worker'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">{user.email}</span>
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.assigned_line_names.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.assigned_line_names.slice(0, 3).map((name, i) => (
                            <span 
                              key={i} 
                              className="text-xs bg-muted px-2 py-0.5 rounded"
                            >
                              {name}
                            </span>
                          ))}
                          {user.assigned_line_names.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{user.assigned_line_names.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No lines assigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.is_active ? (
                        <StatusBadge variant="success" size="sm">Active</StatusBadge>
                      ) : (
                        <StatusBadge variant="default" size="sm">Inactive</StatusBadge>
                      )}
                    </TableCell>
                    {isAdminOrHigher() && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            {user.id !== currentUser?.id && user.role !== 'owner' && user.role !== 'superadmin' && (
                              <DropdownMenuItem 
                                onClick={() => handleEditUser(user)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Access
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdminOrHigher() ? 6 : 5} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <InviteUserDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onSuccess={fetchUsers}
      />
      <EditUserDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        user={selectedUser}
        onSuccess={fetchUsers}
      />
    </div>
  );
}
