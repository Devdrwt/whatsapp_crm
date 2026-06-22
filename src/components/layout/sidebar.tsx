"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useTotalUnread } from "@/hooks/use-total-unread";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  GitBranch,
  Radio,
  Zap,
  Workflow,
  Settings,
  LogOut,
  Moon,
  Sun,
  User,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Brand } from "@/components/layout/brand";

type NavKey =
  | "dashboard"
  | "inbox"
  | "contacts"
  | "pipelines"
  | "broadcasts"
  | "automations"
  | "flows";

interface NavItem {
  href: string;
  /** i18n key under `layout.sidebar.nav.*` */
  key: NavKey;
  icon: typeof LayoutDashboard;
  beta?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/inbox", key: "inbox", icon: MessageSquare },
  { href: "/contacts", key: "contacts", icon: Users },
  { href: "/pipelines", key: "pipelines", icon: GitBranch },
  { href: "/broadcasts", key: "broadcasts", icon: Radio },
  { href: "/automations", key: "automations", icon: Zap },
  { href: "/flows", key: "flows", icon: Workflow, beta: true },
];

const bottomNavItems: { href: string; key: "settings"; icon: typeof Settings }[] = [
  { href: "/settings", key: "settings", icon: Settings },
];

const COLLAPSE_STORAGE_KEY = "drwintech.sidebar-collapsed";

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { resolved, toggle } = useTheme();
  const totalUnread = useTotalUnread();
  const t = useTranslations("layout.sidebar");

  // Desktop-only collapsed state. Persists across reloads via
  // localStorage. The mobile drawer always renders full-width — `lg:`
  // gates everywhere ensure `collapsed` only takes effect on desktop.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      // private-browsing / sandbox — ignore.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore.
      }
      return next;
    });
  };

  // Close the drawer when route changes — users opened it to navigate,
  // so once they pick a destination the drawer should get out of the way.
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Reusable classes: hide on lg+ when collapsed (mobile drawer never collapses).
  const hideOnCollapse = collapsed ? "lg:hidden" : "";
  // Nav rows: when collapsed on desktop, center the icon and drop the gap.
  const collapsedRowClass = collapsed
    ? "lg:justify-center lg:gap-0 lg:px-0"
    : "";

  return (
    <>
      <button
        type="button"
        aria-label={t("closeMenuAria")}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: static + width depends on collapsed.
          "lg:static lg:z-0 lg:translate-x-0 lg:transition-[width] lg:duration-200 lg:ease-out",
          collapsed ? "lg:w-16" : "lg:w-60",
        )}
        aria-label={t("primaryAria")}
      >
        {/* Logo row */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-4",
            collapsed && "lg:justify-center lg:px-2",
          )}
        >
          <Link
            href="/dashboard"
            aria-label={t("logoAria")}
            className="flex items-center"
          >
            {/* On mobile the drawer is full width so the wordmark always
                shows. On desktop, when the sidebar is collapsed, only the
                mark stays — the wordmark hides via lg:hidden. */}
            <Brand wordmarkClassName={cn(collapsed && "lg:hidden")} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeMenuAria")}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main navigation */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto py-4",
            collapsed ? "lg:px-2 px-3" : "px-3",
          )}
        >
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              const showUnreadDot =
                item.href === "/inbox" && totalUnread > 0 && !isActive;

              const label = t(`nav.${item.key}`);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
                      isActive
                        ? "bg-primary-soft text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      collapsedRowClass,
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className={cn("flex-1", hideOnCollapse)}>
                      {label}
                    </span>
                    {item.beta && (
                      <span
                        aria-label={t("beta")}
                        className={cn(
                          "rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300",
                          hideOnCollapse,
                        )}
                      >
                        {t("beta")}
                      </span>
                    )}
                    {showUnreadDot && (
                      <span
                        aria-label={t("unreadAria", { count: totalUnread })}
                        className={cn(
                          "relative flex h-2 w-2",
                          hideOnCollapse,
                        )}
                      >
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="my-4 border-t border-sidebar-border" />

          <ul className="flex flex-col gap-1">
            {bottomNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const label = t(`bottomNav.${item.key}`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
                      isActive
                        ? "bg-primary-soft text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      collapsedRowClass,
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className={cn("flex-1", hideOnCollapse)}>
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={toggle}
                aria-label={
                  resolved === "dark" ? t("themeToLight") : t("themeToDark")
                }
                title={
                  collapsed
                    ? resolved === "dark"
                      ? t("themeLightLabel")
                      : t("themeDarkLabel")
                    : undefined
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:py-2",
                  collapsedRowClass,
                )}
              >
                {resolved === "dark" ? (
                  <Sun className="h-4 w-4 shrink-0" />
                ) : (
                  <Moon className="h-4 w-4 shrink-0" />
                )}
                <span
                  className={cn(
                    "flex-1 text-left",
                    hideOnCollapse,
                  )}
                >
                  {resolved === "dark" ? t("themeLightLabel") : t("themeDarkLabel")}
                </span>
              </button>
            </li>
            {/* Desktop-only collapse / expand toggle. Mobile drawer
                doesn't need it (the X close button handles dismiss). */}
            <li className="hidden lg:block">
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={
                  collapsed ? t("expandAria") : t("collapseAria")
                }
                title={collapsed ? t("expandAria") : t("collapseAria")}
                aria-pressed={collapsed}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  collapsedRowClass,
                )}
              >
                {collapsed ? (
                  <ChevronsRight className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronsLeft className="h-4 w-4 shrink-0" />
                )}
                <span className={cn("flex-1 text-left", hideOnCollapse)}>
                  {t("collapse")}
                </span>
              </button>
            </li>
          </ul>
        </nav>

        {/* User section */}
        <div
          className={cn(
            "shrink-0 border-t border-sidebar-border p-3",
            collapsed && "lg:px-2",
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none data-popup-open:bg-accent",
                collapsed && "lg:justify-center lg:gap-0 lg:px-0",
              )}
              title={collapsed ? (profile?.full_name ?? t("userMenu.fallbackAccount")) : undefined}
            >
              <Avatar className="size-8 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "Avatar"}
                  />
                ) : null}
                <AvatarFallback className="bg-primary-soft text-sm font-medium text-primary">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ??
                    profile?.email?.charAt(0)?.toUpperCase() ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className={cn("min-w-0 flex-1", hideOnCollapse)}>
                <p className="truncate text-sm font-medium text-foreground">
                  {profile?.full_name ?? t("userMenu.fallbackName")}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile?.email ?? ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="min-w-56"
            >
              <DropdownMenuItem
                render={
                  <Link href="/settings?tab=profile" onClick={onClose} />
                }
              >
                <User className="size-4" />
                {t("userMenu.profile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link href="/settings?tab=whatsapp" onClick={onClose} />
                }
              >
                <Settings className="size-4" />
                {t("userMenu.settings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="size-4" />
                {t("userMenu.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
