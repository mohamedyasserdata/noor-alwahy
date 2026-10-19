import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { signInAs } from "./helpers/auth";

const templatePath = "public/templates/student-import.xlsx";

test("US-015 admin previews and atomically imports the official Excel template", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const firstName = "Excel Student One";
  const secondName = "Excel Student Two";

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/students");
  await page.getByText("Import students from Excel", { exact: true }).click();

  const templateResponse = await page.request.get("/templates/student-import.xlsx");
  expect(templateResponse.status()).toBe(200);
  expect((await templateResponse.body()).subarray(0, 2).toString()).toBe("PK");

  await page.locator("#student-workbook").setInputFiles({
    name: "student-import-e2e.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await workbookWithRows([
      [
        firstName,
        "male",
        "2014-01-01",
        "2026-10-19",
        "EG",
        "Africa/Cairo",
        "",
        "",
        "",
        "",
        "false",
      ],
      [
        secondName,
        "female",
        "2015-02-02",
        "2026-10-19",
        "SA",
        "Asia/Riyadh",
        "",
        "",
        "Private note",
        "",
        "true",
      ],
    ]),
  });
  await page.getByRole("button", { name: "Validate and preview" }).click();

  await expect(page.getByText("Rows ready for confirmation (2)")).toBeVisible();
  await expect(page.getByText(firstName, { exact: true })).toBeVisible();
  await expect(page.getByText(secondName, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();

  await expect(page).toHaveURL(/importStatus=confirmed&count=2$/);
  await expect(page.getByText("Imported 2 students successfully.")).toBeVisible();
  await expect(page.getByText(firstName, { exact: true })).toBeVisible();
  await expect(page.getByText(secondName, { exact: true })).toBeVisible();

  await page.getByText("Import students from Excel", { exact: true }).click();
  await page.locator("#student-workbook").setInputFiles({
    name: "student-import-duplicate.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await workbookWithRows([
      [
        firstName,
        "male",
        "2014-01-01",
        "2026-10-19",
        "EG",
        "Africa/Cairo",
        "",
        "",
        "",
        "",
        "false",
      ],
    ]),
  });
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(
    page.getByText("This student is duplicated in the file or already exists."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm import" })).toHaveCount(0);
});

async function workbookWithRows(rows: string[][]) {
  const archive = unzipSync(new Uint8Array(await readFile(templatePath)));
  const sheetPath = "xl/worksheets/sheet1.xml";
  const sheetEntry = archive[sheetPath];
  if (!sheetEntry) throw new Error("The official template is missing the Students worksheet.");
  let sheet = strFromU8(sheetEntry);
  for (let rowNumber = 2; rowNumber <= 201; rowNumber += 1) {
    sheet = sheet.replace(
      new RegExp(`<(?:\\w+:)?row\\b[^>]*r="${rowNumber}"[^>]*>[\\s\\S]*?<\\/(?:\\w+:)?row>`),
      "",
    );
  }
  const xmlRows = rows.map((row, index) => xmlRow(index + 2, row)).join("");
  sheet = sheet.replace(/<\/(?:\w+:)?sheetData>/, `${xmlRows}</x:sheetData>`);
  archive[sheetPath] = strToU8(sheet);
  return Buffer.from(zipSync(archive));
}

function xmlRow(rowNumber: number, values: string[]) {
  const cells = values
    .map((value, index) => {
      if (!value) return "";
      const reference = `${columnName(index)}${rowNumber}`;
      return `<x:c r="${reference}" t="inlineStr"><x:is><x:t>${escapeXml(value)}</x:t></x:is></x:c>`;
    })
    .join("");
  return `<x:row r="${rowNumber}">${cells}</x:row>`;
}

function columnName(index: number) {
  return String.fromCharCode(65 + index);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
