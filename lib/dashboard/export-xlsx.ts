import "server-only";

import { strToU8, zipSync } from "fflate";

import type { AdminDashboardReport } from "@/lib/dashboard/admin-dashboard";

type Cell = string | number | null;
type Sheet = { name: string; rows: Cell[][] };

export function createAdminDashboardWorkbook(
  data: AdminDashboardReport,
  locale: "ar" | "en",
  filters: { from: string; to: string; country: string; currency: string; generatedAt: string },
) {
  const ar = locale === "ar";
  const label = (arabic: string, english: string) => (ar ? arabic : english);
  const sheets: Sheet[] = [
    {
      name: "Overview",
      rows: [
        [label("المؤشر", "Metric"), label("القيمة", "Value")],
        [label("من تاريخ", "From"), filters.from],
        [label("إلى تاريخ", "To"), filters.to],
        [label("الدولة", "Country"), filters.country || label("كل الدول", "All countries")],
        [label("العملة", "Currency"), filters.currency || label("كل العملات", "All currencies")],
        [label("وقت الإنشاء", "Generated at"), filters.generatedAt],
        [label("الطلاب النشطون", "Active students"), data.totals.students],
        [label("المدرسون النشطون", "Active teachers"), data.totals.teachers],
        [label("الاشتراكات الفعالة", "Active subscriptions"), data.totals.active_subscriptions],
        [label("طلبات الالتحاق الجديدة", "New applications"), data.totals.new_applications],
        [label("حضور اليوم (%)", "Attendance today (%)"), data.totals.today_attendance],
        [label("معدل التحويل (%)", "Conversion rate (%)"), data.conversion_rate],
        [label("التسرب الشهري (%)", "Monthly churn (%)"), data.churn_rate],
      ],
    },
    {
      name: "Money",
      rows: [
        [label("النوع", "Type"), label("العملة", "Currency"), label("القيمة", "Amount")],
        ...data.mrr.map((row) => [
          label("الإيراد الشهري المتكرر", "MRR"),
          row.currency,
          row.amount,
        ]),
        ...data.overdue.map((row) => [label("المتأخرات", "Overdue"), row.currency, row.amount]),
      ],
    },
    {
      name: "Attendance",
      rows: [
        [label("اليوم", "Day"), label("نسبة الحضور (%)", "Attendance rate (%)")],
        ...data.attendance.map((row) => [row.day, row.rate]),
      ],
    },
    {
      name: "Finance",
      rows: [
        [
          label("الشهر", "Month"),
          label("العملة", "Currency"),
          label("الإيراد", "Revenue"),
          label("المصروف", "Expense"),
        ],
        ...data.finance.map((row) => [row.month, row.currency, row.revenue, row.expense]),
      ],
    },
    {
      name: "Levels",
      rows: [
        [label("المستوى", "Level"), label("الطلاب", "Students")],
        ...data.levels.map((row) => [ar ? row.name_ar : row.name_en, row.students]),
      ],
    },
    {
      name: "Teachers",
      rows: [
        [
          label("المدرس", "Teacher"),
          label("نسبة الالتزام (%)", "Commitment rate (%)"),
          label("الحصص المحتسبة", "Eligible sessions"),
        ],
        ...data.teachers.map((row) => [row.name, row.rate, row.eligible]),
      ],
    },
    {
      name: "Packages",
      rows: [
        [label("الباقة", "Package"), label("الاشتراكات", "Subscriptions")],
        ...data.packages.map((row) => [
          ar || !row.name_en ? row.name_ar : row.name_en,
          row.subscriptions,
        ]),
      ],
    },
    {
      name: "Risk flags",
      rows: [
        [
          label("رقم الطالب", "Student no."),
          label("الطالب", "Student"),
          label("الدولة", "Country"),
          label("المستوى", "Level"),
          label("درجة الخطر", "Risk score"),
          label("التصنيف", "Level"),
          label("الأسباب", "Reasons"),
          label("الحصص المؤهلة", "Eligible sessions"),
          label("الغياب", "Absences"),
          label("نسبة الغياب (%)", "Absence rate (%)"),
          label("أيام عدم النشاط", "Inactive days"),
          label("متوسط التقييم", "Evaluation average"),
          label("صفحات مراجعة متأخرة", "Overdue review pages"),
          label("حالة الاشتراك", "Subscription status"),
        ],
        ...data.riskFlags.map((row) => [
          row.student_no,
          row.full_name,
          row.country,
          ar ? row.level_name_ar : row.level_name_en,
          row.risk_score,
          row.risk_level,
          row.reasons.join(", "),
          row.eligible_sessions,
          row.absent_sessions,
          row.absence_rate,
          row.inactive_days,
          row.evaluation_average,
          row.overdue_review_pages,
          row.subscription_status,
        ]),
      ],
    },
  ];

  const sheetOverrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  const sheetEntries = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  const relationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": xml(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    "_rels/.rels": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    "xl/workbook.xml": xml(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": xml(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": xml(stylesXml()),
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = xml(sheetXml(sheet.rows, ar));
  });
  return zipSync(files, { level: 6 });
}

function sheetXml(rows: Cell[][], rtl: boolean) {
  const maxColumns = Math.max(...rows.map((row) => row.length), 1);
  const body = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="28" customHeight="1"' : ""}>${row
          .map((value, columnIndex) => cellXml(value, columnIndex, rowIndex))
          .join("")}</row>`,
    )
    .join("");
  const widths = Array.from(
    { length: maxColumns },
    (_, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${index === 1 || index === 6 ? 32 : 18}" customWidth="1"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="${rtl ? 1 : 0}"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${body}</sheetData><autoFilter ref="A1:${columnName(maxColumns - 1)}${Math.max(rows.length, 1)}"/></worksheet>`;
}

function cellXml(value: Cell, column: number, row: number) {
  const reference = `${columnName(column)}${row + 1}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}" s="${row === 0 ? 1 : 2}"><v>${value}</v></c>`;
  }
  const safeValue = value == null ? "" : protectFormula(String(value));
  return `<c r="${reference}" s="${row === 0 ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(safeValue)}</t></is></c>`;
}

function stylesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF102B50"/></patternFill></fill></fills><borders count="2"><border/><border><bottom style="thin"><color rgb="FFD3AA45"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>';
}

function protectFormula(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
function columnName(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}
function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
function xml(value: string) {
  return strToU8(value);
}
