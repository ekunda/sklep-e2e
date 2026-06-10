// Eksport prezentacji do PDF (każdy slajd = osobna strona, dzięki @media print).
// Uruchom z katalogu projektu:  node tools/export-pdf.mjs
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const htmlPath = path.resolve(import.meta.dirname, "../docs/index.html");
const outPath = path.resolve(import.meta.dirname, "../../prezentacja.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
await page.pdf({ path: outPath, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log("PDF zapisany:", outPath);
