import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import * as fs from "fs";

const AZURE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const AZURE_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

export interface OcrResult {
  text: string;
  pages: number;
  keyValuePairs: { key: string; value: string }[];
  tables: { rows: string[][] }[];
}

export function isAzureConfigured(): boolean {
  return !!(AZURE_ENDPOINT && AZURE_KEY);
}

export async function analyzeDocument(filePath: string): Promise<OcrResult> {
  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    throw new Error(
      "Azure Document Intelligence nie je nakonfigurovaný. Nastavte AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT a AZURE_DOCUMENT_INTELLIGENCE_KEY."
    );
  }

  const client = new DocumentAnalysisClient(
    AZURE_ENDPOINT,
    new AzureKeyCredential(AZURE_KEY)
  );

  const fileStream = fs.createReadStream(filePath);

  const poller = await client.beginAnalyzeDocument(
    "prebuilt-layout",
    fileStream,
    {
      locale: "sk-SK",
    }
  );

  const result = await poller.pollUntilDone();

  let fullText = "";
  let pageCount = 0;

  if (result.pages) {
    pageCount = result.pages.length;
    for (const page of result.pages) {
      if (page.lines) {
        for (const line of page.lines) {
          fullText += line.content + "\n";
        }
      }
      fullText += "\n---PAGE_BREAK---\n";
    }
  }

  const keyValuePairs: { key: string; value: string }[] = [];
  if (result.keyValuePairs) {
    for (const kvp of result.keyValuePairs) {
      const key = kvp.key?.content?.trim();
      const value = kvp.value?.content?.trim();
      if (key) {
        keyValuePairs.push({ key, value: value || "" });
      }
    }
  }

  const tables: { rows: string[][] }[] = [];
  if (result.tables) {
    for (const table of result.tables) {
      const rows: string[][] = [];
      const rowCount = table.rowCount || 0;
      const colCount = table.columnCount || 0;
      for (let r = 0; r < rowCount; r++) {
        rows.push(new Array(colCount).fill(""));
      }
      if (table.cells) {
        for (const cell of table.cells) {
          if (cell.rowIndex < rowCount && cell.columnIndex < colCount) {
            rows[cell.rowIndex][cell.columnIndex] = cell.content || "";
          }
        }
      }
      tables.push({ rows });
    }
  }

  return {
    text: fullText.trim(),
    pages: pageCount,
    keyValuePairs,
    tables,
  };
}
