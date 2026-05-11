import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { getSettings } from "@/lib/settings";

// Inter is the only typeface in the SHĀZDEH system.
// Light + Bold are the workhorse weights per the brand book;
// medium/semibold are loaded for UI labels and CTAs.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: {
      default: s.metaTitle ?? `${s.brandName} — Persian Cuisine`,
      template: `%s · ${s.brandName}`,
    },
    description:
      s.metaDesc ??
      "SHĀZDEH — a contemporary Persian food brand rooted in heritage, expressed through a modern visual language. From our heart to your home, in Dubai.",
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ),
    openGraph: {
      type: "website",
      title: s.metaTitle ?? s.brandName,
      description: s.metaDesc ?? "Contemporary Persian cuisine in Dubai.",
      images: s.ogImageUrl ? [s.ogImageUrl] : undefined,
    },
    icons: s.faviconUrl ? { icon: s.faviconUrl } : undefined,
    keywords: [
      "Shazdeh",
      "SHĀZDEH",
      "Persian cuisine Dubai",
      "Contemporary Persian food",
      "Iranian restaurant Dubai",
      "Premium Persian dining",
    ],
  };
}

export const viewport: Viewport = {
  themeColor: "#FDF6EC",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster
          position="bottom-center"
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
