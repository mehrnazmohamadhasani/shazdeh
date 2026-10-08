import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Inter, Vazirmatn } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { ServiceWorker } from "@/components/pwa/service-worker";

// Inter is the brand typeface — loaded as a single variable file so
// Light (body) and Bold (headlines) cost one request, not six.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// Persian dish names (نام فارسی) — Vazirmatn pairs with Inter's
// proportions. Not preloaded: only menu surfaces use it.
const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic"],
  display: "swap",
  preload: false,
});

// The SHĀZDEH logotype is a high-contrast Didone. Until the official
// SVG is uploaded in Settings → Logo, the wordmark is set in Bodoni
// Moda (optical sizes on) as the closest open-licence match.
const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = s.metaTitle ?? `${s.brandName} — Persian Cuisine · Dubai`;
  const description =
    s.metaDesc ??
    "Contemporary Persian cuisine, delivered across Dubai. Slow-cooked khoresh, saffron rice and golden tahdig — from our heart to your home.";

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title: { default: title, template: `%s · ${s.brandName}` },
    description,
    applicationName: s.brandName,
    keywords: [
      "SHĀZDEH",
      "Shazdeh",
      "Persian food Dubai",
      "Persian food delivery Dubai",
      "Iranian food Dubai",
      "Ghormeh Sabzi Dubai",
      "Fesenjan",
      "Tahdig",
      "Persian cuisine",
    ],
    openGraph: {
      type: "website",
      siteName: s.brandName,
      locale: "en_AE",
      title,
      description,
      ...(s.ogImageUrl ? { images: [{ url: s.ogImageUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(s.ogImageUrl ? { images: [s.ogImageUrl] } : {}),
    },
    formatDetection: { telephone: false, email: false, address: false },
    // Installed-app behaviour on iOS / iPadOS (the manifest covers the
    // rest). "default" keeps dark status-bar text over the warm-white
    // header; "black-translucent" would put white text on it.
    appleWebApp: {
      capable: true,
      title: s.brandName,
      statusBarStyle: "default",
    },
    other: {
      // Pre-iOS 16.4 Safari only honours the legacy apple-prefixed name.
      "apple-mobile-web-app-capable": "yes",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#fdf6ec",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  // Lets the layout reach under the notch / home indicator; every fixed or
  // sticky bar pads itself with the safe-area insets (see globals.css).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${vazirmatn.variable} ${bodoni.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <ServiceWorker />
        <Toaster
          position="bottom-center"
          mobileOffset={{
            bottom: "calc(16px + var(--safe-bottom) + var(--tabbar-h))",
            left: "max(16px, var(--safe-left))",
            right: "max(16px, var(--safe-right))",
          }}
          toastOptions={{
            style: {
              background: "#fdf6ec",
              color: "#000000",
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: "8px",
              fontFamily: "var(--font-inter)",
              fontWeight: 400,
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
