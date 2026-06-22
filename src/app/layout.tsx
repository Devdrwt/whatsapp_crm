import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/hooks/use-theme";
import { DEFAULT_MODE, STORAGE_KEY } from "@/lib/themes";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Drwintech",
    template: "%s — Drwintech",
  },
  description: "CRM & automatisation WhatsApp pour les PME — par Drwintech.",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [{ url: "/icon" }],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f9" },
    { media: "(prefers-color-scheme: dark)", color: "#11161c" },
  ],
};

// Inline boot script — runs before React hydrates so the user's
// light/dark mode is on the <html> element before first paint. Without
// this, a dark-mode user would see a flash of light on every load.
//
// Dependency-free string. Mode source = localStorage (key from the
// THEMES module); "system" follows the OS via matchMedia.
const MODE_BOOT_SCRIPT = `
(function(){
  try {
    var KEY = ${JSON.stringify(STORAGE_KEY)};
    var DEFAULT = ${JSON.stringify(DEFAULT_MODE)};
    var stored = localStorage.getItem(KEY);
    var mode = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : DEFAULT;
    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (_e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Locale comes from the drwintech.locale cookie; falls back to FR
  // (see src/lib/i18n/active-locale.ts). Both <html lang> and the
  // intl provider read from the same source, so server-rendered
  // markup and client-side translations stay in sync.
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
    >
      <head>
        <Script
          id="mode-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: MODE_BOOT_SCRIPT }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            {children}
            <Toaster theme="system" position="top-right" richColors closeButton />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
