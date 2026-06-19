import type { Metadata } from "next";
import type { ReactNode } from "react";

// Onboarding pages (e.g. create-org) are part of the funnel between
// "signed up" and "has an org" — they should never compete with the
// marketing site in SERPs.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return children;
}
