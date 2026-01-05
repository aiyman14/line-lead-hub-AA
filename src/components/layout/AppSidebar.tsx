import React from "react";
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
  ChevronDown,
  UserCog,
  Crosshair,
  ClipboardCheck,
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
import logoSvg from "@/assets/logo.svg";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  Crosshair,
  ClipboardCheck,
};

const navLabelKeys: Record<string, string> = {
  'Dashboard': 'nav.dashboard',
  'Sewing Update': 'nav.sewingUpdate',
  'Finishing Update': 'nav.finishingUpdate',
  'Sewing Morning Targets': 'nav.sewingMorningTargets',
  'Sewing End of Day': 'nav.sewingEndOfDay',
  'Finishing Morning Targets': 'nav.finishingMorningTargets',
  'Finishing End of Day': 'nav.finishingEndOfDay',
  'My Submissions': 'nav.mySubmissions',
  'My Preferences': 'nav.myPreferences',
  'Today Updates': 'nav.todayUpdates',
  'Blockers': 'nav.blockers',
  'Report Blocker': 'nav.reportBlocker',
  'This Week': 'nav.thisWeek',
  'All Submissions': 'nav.allSubmissions',
  'Lines': 'nav.lines',
  'Work Orders': 'nav.workOrders',
  'Insights': 'nav.insights',
  'Factory Profile': 'nav.factoryProfile',
  'Users': 'nav.users',
  'Subscription': 'nav.subscription',
  'Billing': 'nav.billing',
  'Tenants': 'nav.tenants',
  'Plans': 'nav.plans',
  'Support': 'nav.support',
};

interface NavItem {
  path: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

export function AppSidebar() {
  const { t } = useTranslation();
  const { profile, roles, factory, signOut } = useAuth();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const [expandedMenus, setExpandedMenus] = React.useState<string[]>(['/setup']);

  const handleSignOut = async () => {
    await signOut();
    // Navigation will happen automatically via AuthContext state change
  };

  // Get highest role for navigation
  const roleHierarchy = ['superadmin', 'owner', 'admin', 'supervisor', 'worker'];
  const highestRole = roleHierarchy.find(r => 
    roles.some(ur => ur.role === r)
  ) || 'worker';

  // Get nav items based on role and department
  let navItems = NAV_ITEMS[highestRole as keyof typeof NAV_ITEMS] || NAV_ITEMS.worker;

  // For workers, filter navigation based on department
  if (highestRole === 'worker' && profile?.department) {
    if (profile.department === 'sewing') {
      navItems = NAV_ITEMS.worker_sewing;
    } else if (profile.department === 'finishing') {
      navItems = NAV_ITEMS.worker_finishing;
    }
    // If department is 'both' or undefined, show all worker items
  }

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some(child => location.pathname === child.path);
    }
    return false;
  };

  const toggleMenu = (path: string) => {
    setExpandedMenus(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

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
          <img 
            src={logoSvg} 
            alt="Production Portal" 
            className="h-10 w-10 shrink-0 rounded-lg"
          />
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
              {(navItems as NavItem[]).map((item) => {
                const Icon = iconMap[item.icon];
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedMenus.includes(item.path);
                const isItemOrChildActive = isActive(item.path) || isParentActive(item);

                if (hasChildren && !collapsed) {
                  return (
                    <Collapsible
                      key={item.path}
                      open={isExpanded}
                      onOpenChange={() => toggleMenu(item.path)}
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors w-full justify-between",
                              isItemOrChildActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {Icon && <Icon className="h-5 w-5 shrink-0" />}
                              <span>{getNavLabel(item.label)}</span>
                            </div>
                            <ChevronDown className={cn(
                              "h-4 w-4 shrink-0 transition-transform",
                              isExpanded && "rotate-180"
                            )} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4">
                          <SidebarMenu>
                            <SidebarMenuItem>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive(item.path)}
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
                                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                                  <span>{getNavLabel(item.label)}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                            {item.children!.map((child) => {
                              const ChildIcon = iconMap[child.icon];
                              return (
                                <SidebarMenuItem key={child.path}>
                                  <SidebarMenuButton
                                    asChild
                                    isActive={isActive(child.path)}
                                  >
                                    <Link
                                      to={child.path}
                                      className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                                        isActive(child.path)
                                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                                      )}
                                    >
                                      {ChildIcon && <ChildIcon className="h-4 w-4 shrink-0" />}
                                      <span>{getNavLabel(child.label)}</span>
                                    </Link>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              );
                            })}
                          </SidebarMenu>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            title={t('common.signOut') || 'Sign Out'}
          >
            <LogOut className="h-4 w-4" />
          </Button>
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
