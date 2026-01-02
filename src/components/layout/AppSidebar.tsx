import { Link, useLocation } from "react-router-dom";
import {
  Factory,
  Package,
  FileText,
  LayoutDashboard,
  CalendarDays,
  AlertTriangle,
  Calendar,
  Rows3,
  ClipboardList,
  TrendingUp,
  Settings,
  Users,
  Building2,
  CreditCard,
  Headphones,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { NAV_ITEMS, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Factory,
  Package,
  FileText,
  LayoutDashboard,
  CalendarDays,
  AlertTriangle,
  Calendar,
  Rows3,
  ClipboardList,
  TrendingUp,
  Settings,
  Users,
  Building2,
  CreditCard,
  HeadphonesIcon: Headphones,
};

export function AppSidebar() {
  const { profile, roles, factory, signOut } = useAuth();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  // Get highest role for navigation
  const roleHierarchy = ['superadmin', 'owner', 'admin', 'supervisor', 'worker'];
  const highestRole = roleHierarchy.find(r => 
    roles.some(ur => ur.role === r)
  ) || 'worker';

  const navItems = NAV_ITEMS[highestRole as keyof typeof NAV_ITEMS] || NAV_ITEMS.worker;

  const isActive = (path: string) => location.pathname === path;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar
      className={cn(
        "border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
      collapsible="icon"
    >
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            PP
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground">
                Production Portal
              </span>
              {factory && (
                <span className="text-xs text-sidebar-foreground/60 truncate max-w-[140px]">
                  {factory.name}
                </span>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="custom-scrollbar">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-foreground/50">
              Menu
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = iconMap[item.icon];
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.path)}
                      tooltip={collapsed ? item.label : undefined}
                    >
                      <Link
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                          isActive(item.path)
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        {Icon && <Icon className="h-5 w-5 shrink-0" />}
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {profile ? getInitials(profile.full_name) : '?'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {profile?.full_name}
              </span>
              <span className="truncate text-xs text-sidebar-foreground/60">
                {ROLE_LABELS[highestRole as keyof typeof ROLE_LABELS]}
              </span>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="mt-2 w-full justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Collapse
            </>
          )}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
