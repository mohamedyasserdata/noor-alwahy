import {
  BookOpenText,
  CheckCircle2,
  Clock3,
  Palette,
  ShieldCheck,
  Sparkles,
  Type,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { BrandMark } from "@/components/brand/brand-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
export function ShowcasePanel() {
  const t = useTranslations("uiShowcase");

  return (
    <section className="grid gap-6">
      <div className="islamic-pattern overflow-hidden rounded-xl border bg-card shadow-soft">
        <div className="grid gap-8 bg-gradient-to-b from-card/78 to-card p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div className="grid content-center gap-5 text-start">
            <BrandMark label={t("brand")} />
            <div className="grid gap-3">
              <Badge variant="secondary" className="gap-1.5">
                <Sparkles aria-hidden="true" />
                {t("eyebrow")}
              </Badge>
              <h2 className="max-w-2xl text-3xl font-black tracking-tight text-balance text-primary sm:text-4xl">
                {t("title")}
              </h2>
              <p className="max-w-2xl text-base leading-8 text-pretty text-muted-foreground sm:text-lg">
                {t("intro")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="gold" size="lg">
                <Sparkles aria-hidden="true" />
                {t("primaryAction")}
              </Button>
              <Button variant="outline" size="lg">
                {t("secondaryAction")}
              </Button>
            </div>
          </div>

          <Card className="self-center border-primary/10 bg-primary text-primary-foreground hover:shadow-soft">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <Badge className="border-white/15 bg-white/10 text-white">
                  {t("progress.badge")}
                </Badge>
                <BookOpenText className="size-6 text-secondary" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl text-primary-foreground">
                {t("progress.title")}
              </CardTitle>
              <CardDescription className="text-primary-foreground/72">
                {t("progress.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="flex items-end justify-between gap-4">
                <span className="text-4xl font-black text-secondary">{t("progress.percent")}</span>
                <span className="text-sm text-primary-foreground/72">
                  {t("progress.valueLabel")}
                </span>
              </div>
              <Progress value={72} aria-label={t("progress.ariaLabel")} className="bg-white/14" />
              <p className="font-quran text-xl leading-9 text-primary-foreground">
                {t("progress.sample")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <Palette className="size-6 text-secondary" aria-hidden="true" />
            <CardTitle>{t("palette.title")}</CardTitle>
            <CardDescription>{t("palette.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <ColorToken colorClass="bg-ivory" label={t("palette.ivory")} code="#FAF6EC" />
            <ColorToken colorClass="bg-warm-white" label={t("palette.warmWhite")} code="#FFFDF8" />
            <ColorToken colorClass="bg-navy" label={t("palette.navy")} code="#0F2547" dark />
            <ColorToken colorClass="bg-gold" label={t("palette.gold")} code="#C9A24B" />
            <ColorToken
              colorClass="bg-calm-green"
              label={t("palette.success")}
              code="#2E7D5B"
              dark
            />
            <ColorToken colorClass="bg-calm-red" label={t("palette.danger")} code="#B64040" dark />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Type className="size-6 text-secondary" aria-hidden="true" />
            <CardTitle>{t("typography.title")}</CardTitle>
            <CardDescription>{t("typography.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-lg border bg-background/60 p-4">
              <p className="text-xs font-bold text-muted-foreground">
                {t("typography.interfaceLabel")}
              </p>
              <p className="mt-2 text-2xl font-black text-primary">
                {t("typography.interfaceSample")}
              </p>
            </div>
            <div className="rounded-lg border bg-background/60 p-4">
              <p className="text-xs font-bold text-muted-foreground">
                {t("typography.quranLabel")}
              </p>
              <p className="mt-2 font-quran text-2xl leading-10 font-bold text-primary">
                {t("typography.quranSample")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <ShieldCheck className="size-6 text-secondary" aria-hidden="true" />
            <CardTitle>{t("form.title")}</CardTitle>
            <CardDescription>{t("form.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="student-name">{t("form.label")}</Label>
              <Input
                id="student-name"
                name="studentName"
                autoComplete="off"
                placeholder={t("form.placeholder")}
              />
              <p className="text-xs leading-5 text-muted-foreground">{t("form.helper")}</p>
            </div>
            <Button type="button" className="w-full">
              {t("form.action")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Alert variant="success">
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>{t("alerts.successTitle")}</AlertTitle>
          <AlertDescription>{t("alerts.successBody")}</AlertDescription>
        </Alert>
        <Alert variant="warning">
          <Clock3 aria-hidden="true" />
          <AlertTitle>{t("alerts.warningTitle")}</AlertTitle>
          <AlertDescription>{t("alerts.warningBody")}</AlertDescription>
        </Alert>
        <Alert>
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>{t("alerts.infoTitle")}</AlertTitle>
          <AlertDescription>{t("alerts.infoBody")}</AlertDescription>
        </Alert>
      </div>
    </section>
  );
}

type ColorTokenProps = {
  colorClass: string;
  label: string;
  code: string;
  dark?: boolean;
};

function ColorToken({ colorClass, label, code, dark = false }: ColorTokenProps) {
  return (
    <div className={`rounded-lg border p-3 ${colorClass} ${dark ? "text-white" : "text-navy"}`}>
      <p className="text-xs font-extrabold">{label}</p>
      <p className="mt-1 font-mono text-[0.6875rem] opacity-75">{code}</p>
    </div>
  );
}
