"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { LogOut, Menu, Moon, Settings as SettingsIcon, Sun, User } from "lucide-react";
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
import { OrgSwitcher } from "@/components/layout/org-switcher";

type PageKey =
  | "dashboard"
  | "inbox"
  | "contacts"
  | "pipelines"
  | "broadcasts"
  | "automations"
  | "flows"
  | "settings";

const PAGE_KEYS: Record<string, PageKey> = {
  "/dashboard": "dashboard",
  "/inbox": "inbox",
  "/contacts": "contacts",
  "/pipelines": "pipelines",
  "/broadcasts": "broadcasts",
  "/automations": "automations",
  "/flows": "flows",
  "/settings": "settings",
};

function getPageKey(pathname: string): PageKey {
  if (PAGE_KEYS[pathname]) return PAGE_KEYS[pathname];
  const match = Object.entries(PAGE_KEYS).find(([path]) =>
    pathname.startsWith(path),
  );
  return match ? match[1] : "dashboard";
}

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile — the
   *  hamburger button is hidden on lg+. */
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { resolved, toggle } = useTheme();
  const t = useTranslations("layout.header");
  const pageKey = getPageKey(pathname);
  const title = t(`pageTitles.${pageKey}`);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger — mobile only. 44×44 hit target per Apple HIG. */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label={t("openMenuAria")}
          className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-1.5">
        <OrgSwitcher />
        <button
          type="button"
          onClick={toggle}
          aria-label={resolved === "dark" ? t("themeToLight") : t("themeToDark")}
          title={resolved === "dark" ? t("themeToLight") : t("themeToDark")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {resolved === "dark" ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-accent focus:bg-accent focus:outline-none data-popup-open:bg-accent sm:gap-3 sm:pl-1 sm:pr-3"
            aria-label={t("userMenu.openAria")}
          >
            <Avatar className="size-8">
              {profile?.avatar_url ? (
                <AvatarImage
                  src={profile.avatar_url}
                  alt={profile.full_name ?? "Avatar"}
                />
              ) : null}
              <AvatarFallback className="bg-primary-soft text-sm font-medium text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium text-foreground sm:inline">
              {profile?.full_name ?? t("userMenu.fallbackName")}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="min-w-56">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium text-foreground">
                {profile?.full_name ?? t("userMenu.fallbackName")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.email ?? ""}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href="/settings?tab=profile" />}
            >
              <User className="size-4" />
              {t("userMenu.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href="/settings?tab=whatsapp" />}
            >
              <SettingsIcon className="size-4" />
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
    </header>
  );
}
