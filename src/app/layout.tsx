import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
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
        <ThemeProvider>
          {children}
          <Toaster theme="system" position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
