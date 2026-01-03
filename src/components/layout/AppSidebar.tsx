import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  Receipt,
  Headphones,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserCog,
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
import { NAV_ITEMS } from "@/lib/constants";
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
  Receipt,
  HeadphonesIcon: Headphones,
  UserCog,
};

const navLabelKeys: Record<string, string> = {
  'Dashboard': 'nav.dashboard',
  'Sewing Update': 'nav.sewingUpdate',
  'Finishing Update': 'nav.finishingUpdate',
  'My Submissions': 'nav.mySubmissions',
  'My Preferences': 'nav.myPreferences',
  'Today Updates': 'nav.todayUpdates',
  'Blockers': 'nav.blockers',
  'This Week': 'nav.thisWeek',
  'All Submissions': 'nav.allSubmissions',
  'Lines': 'nav.lines',
  'Work Orders': 'nav.workOrders',
  'Insights': 'nav.insights',
  'Factory Setup': 'nav.factorySetup',
  'Users': 'nav.users',
  'Subscription': 'nav.subscription',
  'Billing': 'nav.billing',
  'Tenants': 'nav.tenants',
  'Plans': 'nav.plans',
  'Support': 'nav.support',
};

export function AppSidebar() {
  const { t } = useTranslation();
  const { profile, roles, factory, signOut } = useAuth();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  // Get highest role for navigation
  const roleHierarchy = ['superadmin', 'owner', 'admin', 'supervisor', 'worker'];
  const highestRole = roleHierarchy.find(r => 
    roles.some(ur => ur.role === r)
  ) || 'worker';

  let navItems = NAV_ITEMS[highestRole as keyof typeof NAV_ITEMS] || NAV_ITEMS.worker;

  // Filter nav items based on worker's department
  if (highestRole === 'worker' && profile?.department) {
    navItems = navItems.filter(item => {
      if (item.path === '/update/sewing') {
        return profile.department === 'sewing' || profile.department === 'both';
      }
      if (item.path === '/update/finishing') {
        return profile.department === 'finishing' || profile.department === 'both';
      }
      return true;
    });
  }

  const isActive = (path: string) => location.pathname === path;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getNavLabel = (label: string) => {
    const key = navLabelKeys[label];
    return key ? t(key) : label;
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
                {t('app.name')}
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
              {t('common.menu')}
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
                      tooltip={collapsed ? getNavLabel(item.label) : undefined}
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
                        {!collapsed && <span>{getNavLabel(item.label)}</span>}
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
                {t(`roles.${highestRole}`)}
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
              {t('common.collapse')}
            </>
          )}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
