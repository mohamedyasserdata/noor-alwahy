import { CalendarDays, Clock3, GraduationCap, UserRound } from "lucide-react";
import { DateTime } from "luxon";

import { Badge } from "@/components/ui/badge";
import type { AppLocale } from "@/i18n/routing";
import { buildWeeklyScheduleGrid } from "@/lib/schedules/weekly-grid";

type ScheduleSlot = {
  slot_id: string;
  student_name: string;
  teacher_name: string;
  track_name_ar: string;
  track_name_en: string | null;
  weekday: number;
  local_start_time: string;
  duration_min: number;
  anchor_timezone: string;
  viewer: { weekday: number; time: string } | null;
};

const toneClasses = [
  "border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-100",
  "border-blue-200 bg-blue-50/90 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-100",
  "border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100",
  "border-violet-200 bg-violet-50/90 text-violet-950 dark:border-violet-900/70 dark:bg-violet-950/35 dark:text-violet-100",
  "border-rose-200 bg-rose-50/90 text-rose-950 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-100",
] as const;

export function WeeklyScheduleGrid({
  slots,
  locale,
  role,
  timezone,
  labels,
}: {
  slots: ScheduleSlot[];
  locale: AppLocale;
  role: string;
  timezone: string;
  labels: {
    title: string;
    description: string;
    lessonCount: string;
    lessonsAtTime: string;
    student: string;
    teacher: string;
    empty: string;
    weekdays: string[];
  };
}) {
  if (!slots.length) {
    return (
      <section className="mt-8 rounded-[1.75rem] border border-dashed border-secondary/35 bg-card/75 p-10 text-center text-muted-foreground">
        <CalendarDays className="mx-auto size-9 text-secondary" aria-hidden="true" />
        <p className="mt-3">{labels.empty}</p>
      </section>
    );
  }

  const { times, slotsByCell } = buildWeeklyScheduleGrid(slots);
  const today = DateTime.now().setZone(timezone).startOf("day");
  const todayIndex = today.weekday % 7;
  const weekStart = today.minus({ days: todayIndex });
  const dates = labels.weekdays.map((_, index) =>
    weekStart
      .plus({ days: index })
      .setLocale(locale === "ar" ? "ar-EG" : "en-US")
      .toFormat("d LLL"),
  );

  return (
    <section
      className="mt-8 overflow-hidden rounded-[1.75rem] border bg-card shadow-card"
      aria-labelledby="weekly-grid-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 sm:px-7">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-secondary/12 text-secondary">
              <CalendarDays className="size-5" aria-hidden="true" />
            </span>
            <h2 id="weekly-grid-title" className="text-xl font-black text-primary sm:text-2xl">
              {labels.title}
            </h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {labels.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{timezone}</Badge>
          <Badge className="tabular-nums" variant="secondary">
            {labels.lessonCount.replace("{count}", String(slots.length))}
          </Badge>
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain" tabIndex={0} aria-label={labels.title}>
        <div className="min-w-[68rem] p-3 sm:p-5">
          <div className="grid grid-cols-[5.5rem_repeat(7,minmax(8rem,1fr))] overflow-hidden rounded-2xl border bg-background/45">
            <div className="border-e border-b bg-primary/[0.035]" aria-hidden="true" />
            {labels.weekdays.map((day, index) => (
              <div
                key={day}
                className={`border-e border-b px-3 py-3 text-center text-sm font-black text-primary last:border-e-0 ${index === todayIndex ? "bg-blue-50/80 text-blue-700 dark:bg-blue-950/35 dark:text-blue-200" : ""}`}
                data-weekday={index}
              >
                <span className="block">{day}</span>
                <time
                  className="mt-1 block text-xs font-bold text-muted-foreground"
                  dateTime={weekStart.plus({ days: index }).toISODate() ?? undefined}
                >
                  {dates[index]}
                </time>
              </div>
            ))}

            {times.flatMap((time) => {
              const row = [
                <div
                  key={`time-${time}`}
                  className="flex min-h-28 items-start justify-center border-e border-b bg-primary/[0.025] px-2 py-4 text-sm font-black text-primary tabular-nums last:border-b-0"
                  dir="ltr"
                >
                  <Clock3 className="me-1.5 mt-0.5 size-4 text-secondary" aria-hidden="true" />
                  {formatTime(time, locale)}
                </div>,
              ];
              for (let day = 0; day < 7; day += 1) {
                const cellSlots = slotsByCell.get(`${day}-${time}`) ?? [];
                row.push(
                  <div
                    key={`${day}-${time}`}
                    className={`min-h-28 border-e border-b p-2 last:border-e-0 ${day === todayIndex ? "bg-blue-50/25 dark:bg-blue-950/10" : ""}`}
                    data-testid={`schedule-cell-${day}-${time}`}
                  >
                    {role === "admin" && cellSlots.length > 1 ? (
                      <div className="mb-2 flex justify-end">
                        <Badge variant="secondary">
                          {labels.lessonsAtTime.replace("{count}", String(cellSlots.length))}
                        </Badge>
                      </div>
                    ) : null}
                    <div className="grid gap-2">
                      {cellSlots.map((slot) => (
                        <article
                          key={slot.slot_id}
                          className={`rounded-xl border p-3 shadow-[0_4px_14px_rgba(16,31,59,0.05)] ${toneClasses[toneIndex(slot.slot_id)]}`}
                        >
                          <h3 className="text-sm leading-5 font-black">
                            {locale === "ar"
                              ? slot.track_name_ar
                              : (slot.track_name_en ?? slot.track_name_ar)}
                          </h3>
                          <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 opacity-80">
                            <UserRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              <span className="sr-only">{labels.student}: </span>
                              {slot.student_name}
                            </span>
                          </p>
                          <p className="flex items-start gap-1.5 text-xs leading-5 opacity-80">
                            <GraduationCap
                              className="mt-0.5 size-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              <span className="sr-only">{labels.teacher}: </span>
                              {slot.teacher_name}
                            </span>
                          </p>
                          <p
                            className="mt-2 text-[0.7rem] font-bold tabular-nums opacity-70"
                            dir="ltr"
                          >
                            {formatTime(time, locale)} · {slot.duration_min} min
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>,
                );
              }
              return row;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function toneIndex(id: string) {
  let value = 0;
  for (let index = 0; index < id.length; index += 1) value += id.charCodeAt(index);
  return value % toneClasses.length;
}

function formatTime(time: string, locale: AppLocale) {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(Date.UTC(2020, 0, 1, hour, minute));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}
