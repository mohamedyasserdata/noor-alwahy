"use client";

import { ArrowDown, ArrowUp, Copy, Eye, GripVertical, Pencil, Power } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  clonePackageAction,
  reorderPackagesAction,
  togglePackageAction,
} from "@/lib/packages/actions";

export type PackageBoardItem = {
  id: string;
  slug: string;
  name: string;
  sessionsPerWeek: number;
  durationMin: number;
  isPublished: boolean;
  isActive: boolean;
  fallbackPrice: { amount: number; currency: string } | null;
};

export function PackageOrderBoard({ packages }: { packages: PackageBoardItem[] }) {
  const locale = useLocale();
  const t = useTranslations("packageAdmin");
  const [ordered, setOrdered] = useState(packages);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    const current = next[index];
    const destination = next[target];
    if (!current || !destination) return;
    next[index] = destination;
    next[target] = current;
    setOrdered(next);
  }

  function drop(beforeId: string) {
    if (!draggedId || draggedId === beforeId) return;
    const next = ordered.filter((item) => item.id !== draggedId);
    const dragged = ordered.find((item) => item.id === draggedId);
    const target = next.findIndex((item) => item.id === beforeId);
    if (!dragged || target < 0) return;
    next.splice(target, 0, dragged);
    setOrdered(next);
    setDraggedId(null);
  }

  if (!ordered.length) {
    return (
      <p className="rounded-3xl border border-dashed bg-card p-8 text-center text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <form action={reorderPackagesAction.bind(null, locale)} className="flex justify-end">
        <input
          type="hidden"
          name="packageIds"
          value={JSON.stringify(ordered.map((item) => item.id))}
        />
        <AdminSubmitButton
          label={t("actions.saveOrder")}
          pendingLabel={t("actions.savingOrder")}
          variant="outline"
        />
      </form>
      <ol className="grid gap-3">
        {ordered.map((item, index) => (
          <li
            key={item.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => drop(item.id)}
            className="rounded-2xl border bg-card p-4 shadow-card"
          >
            <article className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
              <button
                type="button"
                draggable
                onDragStart={() => setDraggedId(item.id)}
                onDragEnd={() => setDraggedId(null)}
                className="hidden size-11 cursor-grab place-items-center rounded-xl border text-muted-foreground hover:text-primary lg:grid"
                aria-label={t("actions.drag", { package: item.name })}
              >
                <GripVertical aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-primary">{item.name}</h3>
                  <Badge variant={item.isPublished ? "success" : "outline"}>
                    {item.isPublished ? t("published") : t("draft")}
                  </Badge>
                  {!item.isActive ? <Badge variant="warning">{t("inactive")}</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("packageSummary", {
                    sessions: item.sessionsPerWeek,
                    minutes: item.durationMin,
                  })}
                  {item.fallbackPrice
                    ? ` · ${item.fallbackPrice.amount} ${item.fallbackPrice.currency}`
                    : ` · ${t("missingFallbackPrice")}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={t("actions.moveUp")}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={index === ordered.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={t("actions.moveDown")}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={{ pathname: "/admin/packages", query: { preview: item.id } }}>
                    <Eye aria-hidden="true" />
                    {t("actions.preview")}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={{ pathname: "/admin/packages/wizard", query: { package: item.id } }}>
                    <Pencil aria-hidden="true" />
                    {t("actions.edit")}
                  </Link>
                </Button>
                <form action={clonePackageAction.bind(null, locale)}>
                  <input type="hidden" name="packageId" value={item.id} />
                  <Button type="submit" size="sm" variant="outline">
                    <Copy aria-hidden="true" />
                    {t("actions.clone")}
                  </Button>
                </form>
                <form action={togglePackageAction.bind(null, locale)}>
                  <input type="hidden" name="packageId" value={item.id} />
                  <input type="hidden" name="publish" value={String(!item.isPublished)} />
                  <Button type="submit" size="sm" variant={item.isPublished ? "ghost" : "gold"}>
                    <Power aria-hidden="true" />
                    {item.isPublished ? t("actions.hide") : t("actions.publish")}
                  </Button>
                </form>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
