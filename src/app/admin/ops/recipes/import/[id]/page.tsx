/* eslint-disable @next/next/no-img-element -- private document served by an authenticated route, not next/image */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdminPage, Card, StatusPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { DOC_STATUS } from "@/components/admin/ops/status";
import { DiscardButton, RetryRead } from "@/components/admin/ops/document-actions";
import { RecipeImportForm } from "@/components/admin/ops/recipe-import-form";
import { day } from "@/components/admin/ops/format";
import { getRecipeImport } from "@/lib/ops/recipe-import";
import { getAdminI18n } from "@/lib/admin-i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("Recipe photo") };
}

export default async function RecipeImportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dish?: string }> }) {
  const [{ t, intl }, { id }, { dish }] = await Promise.all([getAdminI18n(), params, searchParams]);
  // Added from a dish's page: the recipe is for that dish.
  const data = await getRecipeImport(id, dish?.slice(0, 40) ?? null);
  if (!data) notFound();
  const { doc, reading } = data;
  const fileUrl = `/api/admin/ops/documents/${doc.id}/file`;
  const status = DOC_STATUS[doc.status];

  const original = (
    <Card
      title={t("Original")}
      actions={
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-terracotta-ink underline-offset-4 hover:underline">
          {t("Full size")} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      }
      bodyClassName="p-3"
    >
      {doc.mimeType === "application/pdf" ? (
        <object data={fileUrl} type="application/pdf" className="h-[45vh] w-full rounded-[10px] lg:h-[75vh]">
          <a href={fileUrl}>{t("Open the PDF")}</a>
        </object>
      ) : (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
          <img src={fileUrl} alt={t("Recipe photo")} className="max-h-[40vh] w-full rounded-[10px] object-contain lg:max-h-none" />
        </a>
      )}
      <p className="mt-2 px-1 text-[12px] text-dark-grey">
        {doc.uploadedBy
          ? t("Uploaded {date} by {name}", { date: day(doc.createdAt, true, intl), name: doc.uploadedBy.name ?? doc.uploadedBy.email })
          : t("Uploaded {date}", { date: day(doc.createdAt, true, intl) })}
        {doc.aiModel ? ` · ${t("read by {model}", { model: doc.aiModel })}` : ""}
      </p>
    </Card>
  );

  let body: React.ReactNode;
  if (doc.status === "NEEDS_REVIEW" && reading) {
    body = (
      <Card
        title={reading.title ? <span dir="auto">{reading.title}</span> : t("Check the recipe")}
        description={t("Match each line to an ingredient or prep. Lines marked “check this” were hard to read.")}
        actions={<DiscardButton documentId={doc.id} redirectTo="/admin/ops/recipes" />}
      >
        <RecipeImportForm documentId={doc.id} reading={reading} matches={data.matches} target={data.target} options={data.options} />
      </Card>
    );
  } else if (doc.status === "FAILED" || (doc.status === "NEEDS_REVIEW" && !reading)) {
    body = (
      <Card title={t("Couldn't read this photo")}>
        {doc.error && <p className="mb-4 text-[13px] text-dark-grey">{doc.error}</p>}
        <div className="flex flex-wrap gap-2">
          <RetryRead documentId={doc.id} />
          <DiscardButton documentId={doc.id} redirectTo="/admin/ops/recipes" />
        </div>
      </Card>
    );
  } else if (doc.status === "SAVED") {
    const recipeId = doc.recipeVersions[0]?.recipeId;
    body = (
      <Card title={t("Saved")}>
        <p className="mb-4 text-[14px] text-dark-grey">{t("This photo was saved as a recipe draft.")}</p>
        {recipeId && (
          <Button asChild size="md">
            <Link href={`/admin/ops/recipes/${recipeId}`}>{t("Open the recipe")}</Link>
          </Button>
        )}
      </Card>
    );
  } else {
    body = (
      <Card>
        <p className="text-[14px] text-dark-grey">{doc.status === "PROCESSING" ? t("Still reading — refresh in a moment.") : t("This photo was discarded.")}</p>
        {doc.status === "DISCARDED" && (
          <div className="mt-4">
            <RetryRead documentId={doc.id} />
          </div>
        )}
      </Card>
    );
  }

  return (
    <AdminPage
      title={
        <span className="flex flex-wrap items-center gap-3">
          <Link href="/admin/ops/recipes" aria-label={t("Back to recipes")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black-iron/[0.05]">
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
          {t("Recipe photo")}
          <StatusPill tone={status.tone}>{t(status.label)}</StatusPill>
        </span>
      }
      className="max-w-7xl"
    >
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-6">{original}</div>
        {body}
      </div>
    </AdminPage>
  );
}
