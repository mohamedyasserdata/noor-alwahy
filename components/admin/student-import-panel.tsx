"use client";

import { FileSpreadsheet } from "lucide-react";
import { useActionState } from "react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  confirmStudentImportAction,
  previewStudentImportAction,
  type StudentImportState,
} from "@/lib/students/student-import-actions";

type Copy = {
  title: string;
  description: string;
  template: string;
  file: string;
  preview: string;
  previewing: string;
  confirm: string;
  confirming: string;
  ready: string;
  errorTitle: string;
  columns: { row: string; name: string; gender: string; joined: string; notes: string };
  yes: string;
  no: string;
  errors: Record<string, string>;
};

export function StudentImportPanel({ locale, copy }: { locale: AppLocale; copy: Copy }) {
  const initialState: StudentImportState = { errors: [], preview: [] };
  const [state, action] = useActionState(
    previewStudentImportAction.bind(null, locale),
    initialState,
  );
  return (
    <details className="mt-6 rounded-2xl border bg-card shadow-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-3 font-black text-primary focus-visible:ring-2 focus-visible:ring-ring">
        <FileSpreadsheet className="size-5 text-secondary" aria-hidden="true" />
        {copy.title}
      </summary>
      <div className="border-t p-5">
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{copy.description}</p>
        <Button asChild variant="outline" className="mt-4">
          <a href="/templates/student-import.xlsx" download>
            {copy.template}
          </a>
        </Button>
        <form action={action} className="mt-5 grid max-w-2xl gap-3">
          <Label htmlFor="student-workbook">{copy.file}</Label>
          <Input
            id="student-workbook"
            name="workbook"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
          />
          <AdminSubmitButton label={copy.preview} pendingLabel={copy.previewing} />
        </form>

        {state.fileError ? (
          <p className="mt-4 text-sm font-bold text-destructive" role="alert">
            {importErrorMessage(copy.errors, state.fileError)}
          </p>
        ) : null}
        {state.errors.length ? (
          <div className="mt-5" role="alert">
            <h3 className="font-black text-destructive">{copy.errorTitle}</h3>
            <ul className="mt-2 grid gap-1 text-sm text-destructive">
              {state.errors.slice(0, 50).map((error, index) => (
                <li key={`${error.row}-${error.column}-${index}`}>
                  {copy.columns.row} {error.row} · {error.column}:{" "}
                  {importErrorMessage(copy.errors, error.code)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {state.batchId ? (
          <div className="mt-6">
            <p className="font-black text-primary">
              {copy.ready} ({state.preview.length})
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-2xl text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-3 py-2 text-start">{copy.columns.row}</th>
                    <th className="px-3 py-2 text-start">{copy.columns.name}</th>
                    <th className="px-3 py-2 text-start">{copy.columns.gender}</th>
                    <th className="px-3 py-2 text-start">{copy.columns.joined}</th>
                    <th className="px-3 py-2 text-start">{copy.columns.notes}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.preview.map((row) => (
                    <tr key={row.row} className="border-b">
                      <td className="px-3 py-2 tabular-nums">{row.row}</td>
                      <td className="px-3 py-2 font-bold">{row.fullName}</td>
                      <td className="px-3 py-2">{row.gender}</td>
                      <td className="px-3 py-2 tabular-nums">{row.joinedAt}</td>
                      <td className="px-3 py-2">{row.hasPrivateNotes ? copy.yes : copy.no}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form action={confirmStudentImportAction.bind(null, locale)} className="mt-4">
              <input type="hidden" name="batchId" value={state.batchId} />
              <AdminSubmitButton label={copy.confirm} pendingLabel={copy.confirming} />
            </form>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function importErrorMessage(errors: Record<string, string>, code: string) {
  const camelCode = code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return errors[code] ?? errors[camelCode] ?? errors.requestFailed;
}
