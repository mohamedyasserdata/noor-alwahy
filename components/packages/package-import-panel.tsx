"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmPackageImportAction,
  previewPackageImportAction,
  type PackageImportState,
} from "@/lib/packages/import-actions";

export function PackageImportPanel() {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("packageAdmin.import");
  const initialState: PackageImportState = { errors: [], preview: [] };
  const [state, action] = useActionState(
    previewPackageImportAction.bind(null, locale),
    initialState,
  );

  return (
    <details className="mt-6 rounded-2xl border bg-card shadow-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-3 font-black text-primary focus-visible:ring-2 focus-visible:ring-ring">
        <FileSpreadsheet className="size-5 text-secondary" aria-hidden="true" />
        {t("title")}
      </summary>
      <div className="border-t p-5">
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{t("description")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`/api/admin/packages/export?locale=${locale}&template=true`} download>
              <Download aria-hidden="true" />
              {t("template")}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/admin/packages/export?locale=${locale}`} download>
              <Download aria-hidden="true" />
              {t("exportXlsx")}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/admin/packages/export?locale=${locale}&format=csv`} download>
              <Download aria-hidden="true" />
              {t("exportCsv")}
            </a>
          </Button>
        </div>
        <form action={action} className="mt-5 grid max-w-2xl gap-3">
          <Label htmlFor="package-workbook">{t("file")}</Label>
          <Input
            id="package-workbook"
            name="workbook"
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            required
          />
          <AdminSubmitButton label={t("preview")} pendingLabel={t("previewing")} />
        </form>

        {state.fileError ? (
          <p className="mt-4 text-sm font-bold text-destructive" role="alert">
            {errorMessage(t, state.fileError)}
          </p>
        ) : null}
        {state.errors.length ? (
          <div className="mt-5" role="alert">
            <h3 className="font-black text-destructive">{t("errorTitle")}</h3>
            <ul className="mt-2 grid gap-1 text-sm text-destructive">
              {state.errors.slice(0, 60).map((error, index) => (
                <li key={`${error.row}-${error.column}-${index}`}>
                  {t("row", { row: error.row })} · {error.column}: {errorMessage(t, error.code)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {state.batchId ? (
          <div className="mt-6">
            <p className="font-black text-primary">{t("ready", { count: state.preview.length })}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-2xl text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-3 py-2 text-start">{t("columns.slug")}</th>
                    <th className="px-3 py-2 text-start">{t("columns.name")}</th>
                    <th className="px-3 py-2 text-start">{t("columns.prices")}</th>
                    <th className="px-3 py-2 text-start">{t("columns.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.preview.map((item) => (
                    <tr key={item.slug} className="border-b">
                      <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                        {item.slug}
                      </td>
                      <td className="px-3 py-2 font-bold">{item.nameAr}</td>
                      <td className="px-3 py-2 tabular-nums">{item.priceCount}</td>
                      <td className="px-3 py-2">{item.published ? t("published") : t("draft")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form action={confirmPackageImportAction.bind(null, locale)} className="mt-4">
              <input type="hidden" name="batchId" value={state.batchId} />
              <AdminSubmitButton label={t("confirm")} pendingLabel={t("confirming")} />
            </form>
          </div>
        ) : null}
        <p className="mt-5 flex items-center gap-2 text-xs leading-6 text-muted-foreground">
          <Upload className="size-4" aria-hidden="true" />
          {t("limits")}
        </p>
      </div>
    </details>
  );
}

function errorMessage(t: ReturnType<typeof useTranslations<"packageAdmin.import">>, code: string) {
  const camel = code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return t(`errors.${camel}` as "errors.invalidFile");
}
