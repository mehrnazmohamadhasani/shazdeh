import type { MetadataRoute } from "next";

/*
 * Web app manifest — what makes SHĀZDEH installable and what the
 * installed app looks like. Static on purpose: browsers cache it hard
 * and compare it on update, so it should not depend on CMS settings.
 *
 * `id` pins the app's identity to "/" so changing start_url later never
 * makes browsers treat it as a different app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SHĀZDEH — Persian Cuisine",
    short_name: "SHĀZDEH",
    description:
      "Contemporary Persian cuisine, delivered across Dubai. Browse the menu and order direct from the SHĀZDEH kitchen.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#fdf6ec",
    theme_color: "#fdf6ec",
    lang: "en-AE",
    dir: "ltr",
    categories: ["food", "shopping", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Order now",
        short_name: "Order",
        description: "Order delivery direct from the kitchen",
        url: "/order",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Menu",
        description: "Browse the full SHĀZDEH menu",
        url: "/menu",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
