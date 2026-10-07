import type { Metadata } from "next";
import SiteLayout from "./(site)/layout";
import { NotFoundContent } from "@/components/shared/not-found-content";

// Unmatched URLs render here (route-group not-found files only catch
// notFound() calls inside the group), so wrap in the site chrome.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function RootNotFound() {
  return (
    <SiteLayout>
      <NotFoundContent />
    </SiteLayout>
  );
}
