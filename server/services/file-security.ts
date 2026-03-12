import fs from "fs";
import path from "path";
import { execFile } from "child_process";

const CLAMAV_DB_DIR = path.join(process.cwd(), ".clamav");

const MAGIC_BYTES: Record<string, { bytes: number[]; offset: number }[]> = {
  "application/pdf": [{ bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 }],
  "image/jpeg": [{ bytes: [0xff, 0xd8, 0xff], offset: 0 }],
  "image/png": [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 }],
  "image/gif": [{ bytes: [0x47, 0x49, 0x46, 0x38], offset: 0 }],
  "image/webp": [{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }],
  "image/bmp": [{ bytes: [0x42, 0x4d], offset: 0 }],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [{ bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0 }],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [{ bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0 }],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [{ bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0 }],
  "application/vnd.ms-excel": [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], offset: 0 }],
  "application/msword": [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], offset: 0 }],
  "application/vnd.ms-powerpoint": [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], offset: 0 }],
  "video/mp4": [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  "video/quicktime": [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  "video/x-msvideo": [{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }],
  "video/x-matroska": [{ bytes: [0x1a, 0x45, 0xdf, 0xa3], offset: 0 }],
  "video/webm": [{ bytes: [0x1a, 0x45, 0xdf, 0xa3], offset: 0 }],
  "application/json": [],
  "text/plain": [],
  "text/csv": [],
};

const DANGEROUS_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif", ".vbs",
  ".vbe", ".js", ".jse", ".wsf", ".wsh", ".ps1", ".psm1", ".reg",
  ".inf", ".hta", ".cpl", ".msp", ".mst", ".sct", ".ws",
  ".dll", ".sys", ".drv", ".ocx", ".gadget",
]);

const PE_HEADER = [0x4d, 0x5a];
const ELF_HEADER = [0x7f, 0x45, 0x4c, 0x46];

const DANGEROUS_FORMULA_KEYWORDS = ["CMD", "EXEC", "SYSTEM", "POWERSHELL", "MSHTA", "WSCRIPT", "CSCRIPT", "SHELL", "CALL", "REGISTER"];
const DANGEROUS_CELL_PREFIXES = ["=CMD", "=EXEC", "=SYSTEM", "+CMD", "-CMD", "@CMD", "=SHELL", "+SHELL", "-SHELL", "=CALL", "+CALL", "-CALL", "=MSHTA", "+MSHTA", "-MSHTA"];

export interface SecurityScanResult {
  safe: boolean;
  reason?: string;
  layer?: string;
}

function detectMimeFromBytes(filePath: string): string | null {
  try {
    const fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);

    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "image/jpeg";
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return "image/png";
    if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) return "image/gif";
    if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) return "application/pdf";
    if (header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) return "application/zip";
    if (header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0) return "application/x-ole-storage";
    if (header[0] === 0x42 && header[1] === 0x4d) return "image/bmp";
    if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) return "application/riff";
    if (header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3) return "video/matroska";
    if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) return "video/mp4";
    if (header[0] === 0x4d && header[1] === 0x5a) return "application/x-executable";
    if (header[0] === 0x7f && header[1] === 0x45 && header[2] === 0x4c && header[3] === 0x46) return "application/x-executable";

    return null;
  } catch {
    return null;
  }
}

const MIME_COMPATIBILITY: Record<string, Set<string>> = {
  "application/zip": new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]),
  "application/x-ole-storage": new Set([
    "application/vnd.ms-excel",
    "application/msword",
    "application/vnd.ms-powerpoint",
  ]),
  "application/riff": new Set([
    "image/webp",
    "video/x-msvideo",
  ]),
  "video/matroska": new Set([
    "video/x-matroska",
    "video/webm",
  ]),
  "video/mp4": new Set([
    "video/mp4",
    "video/quicktime",
  ]),
};

function validateMagicBytes(filePath: string, declaredMime: string): SecurityScanResult {
  try {
    const detectedMime = detectMimeFromBytes(filePath);

    if (detectedMime === "application/x-executable") {
      return { safe: false, reason: "Súbor obsahuje spustiteľný kód (PE/ELF hlavička)", layer: "magic_bytes" };
    }

    if (!detectedMime) {
      const textTypes = new Set(["text/plain", "text/csv", "application/json"]);
      if (textTypes.has(declaredMime)) {
        return { safe: true };
      }
      return { safe: false, reason: "Nepodarilo sa identifikovať typ súboru z jeho obsahu", layer: "magic_bytes" };
    }

    if (detectedMime === declaredMime) return { safe: true };

    const compatible = MIME_COMPATIBILITY[detectedMime];
    if (compatible && compatible.has(declaredMime)) return { safe: true };

    if (detectedMime === declaredMime.split(";")[0]) return { safe: true };

    return {
      safe: false,
      reason: `Vnútorná štruktúra súboru (${detectedMime}) nezodpovedá deklarovanému typu (${declaredMime})`,
      layer: "magic_bytes",
    };
  } catch (err: any) {
    console.error("[SECURITY] Magic bytes check error:", err.message);
    return { safe: false, reason: "Nepodarilo sa overiť štruktúru súboru", layer: "magic_bytes" };
  }
}

function checkDangerousExtension(originalName: string): SecurityScanResult {
  const ext = path.extname(originalName).toLowerCase();
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { safe: false, reason: `Nebezpečná prípona súboru: ${ext}`, layer: "extension" };
  }
  return { safe: true };
}

function scanWithClamAV(filePath: string): Promise<SecurityScanResult> {
  return new Promise((resolve) => {
    const dbExists = fs.existsSync(path.join(CLAMAV_DB_DIR, "main.cvd")) || fs.existsSync(path.join(CLAMAV_DB_DIR, "main.cld"));

    if (!dbExists) {
      console.error("[SECURITY] ClamAV databáza nie je dostupná — upload BLOKOVANÝ (fail-closed)");
      resolve({ safe: false, reason: "Antivírusový skener nie je dostupný. Kontaktujte administrátora.", layer: "clamav_unavailable" });
      return;
    }

    const resolvedPath = path.resolve(filePath);

    execFile("clamscan", ["--no-summary", `--database=${CLAMAV_DB_DIR}`, resolvedPath], { timeout: 30000 }, (error, stdout, _stderr) => {
      if (error) {
        if (error.code === 1) {
          const virusName = stdout.split(":").pop()?.trim().replace("FOUND", "").trim() || "neznámy";
          resolve({
            safe: false,
            reason: `Antivírusový skener detekoval hrozbu: ${virusName}`,
            layer: "clamav",
          });
        } else {
          console.error("[SECURITY] ClamAV scan error:", error.message);
          resolve({ safe: false, reason: "Antivírusový sken zlyhal. Súbor bol zablokovaný z bezpečnostných dôvodov.", layer: "clamav_error" });
        }
        return;
      }
      resolve({ safe: true, layer: "clamav" });
    });
  });
}

function isCellFormula(cell: any): boolean {
  if (!cell || !cell.value) return false;
  if (typeof cell.value === "object" && cell.value !== null) {
    return "formula" in cell.value || "sharedFormula" in cell.value;
  }
  return false;
}

export function sanitizeExcelWorkbook(workbook: any): void {
  if (!workbook) return;

  if (workbook.vbaProject) {
    workbook.vbaProject = undefined;
    console.warn("[SECURITY] Removed VBA macro project from Excel file");
  }

  if (workbook.model) {
    if (workbook.model.definedNames) {
      const original = workbook.model.definedNames.length;
      const filtered = workbook.model.definedNames.filter((dn: any) => {
        const name = (dn.name || "").toUpperCase();
        const ranges = JSON.stringify(dn.ranges || []).toUpperCase();
        if (name.startsWith("_XLN") || name.includes("\\")) return false;
        if (DANGEROUS_FORMULA_KEYWORDS.some(k => ranges.includes(k))) return false;
        return true;
      });
      if (filtered.length < original) {
        console.warn(`[SECURITY] Removed ${original - filtered.length} suspicious defined names from Excel`);
      }
      workbook.model.definedNames = filtered;
    }
  }

  for (const worksheet of workbook.worksheets || []) {
    for (let rowNum = 1; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      row.eachCell({ includeEmpty: false }, (cell: any) => {
        if (isCellFormula(cell)) {
          const formula = String(cell.value.formula || cell.value.sharedFormula || "").toUpperCase();
          if (DANGEROUS_FORMULA_KEYWORDS.some(d => formula.includes(d))) {
            console.warn(`[SECURITY] Blocked dangerous formula in cell ${cell.address}: ${formula.substring(0, 50)}`);
            cell.value = "[BLOKOVANÉ: nebezpečný vzorec]";
          }
        }

        if (typeof cell.value === "string") {
          const upper = cell.value.toUpperCase().trim();
          if (DANGEROUS_CELL_PREFIXES.some(prefix => upper.startsWith(prefix))) {
            console.warn(`[SECURITY] Blocked dangerous cell content in ${cell.address}`);
            cell.value = "[BLOKOVANÉ: nebezpečný obsah]";
          }
        }

        if (cell.value && typeof cell.value === "object" && "hyperlink" in cell.value) {
          const link = String(cell.value.hyperlink || "").toLowerCase();
          if (link.startsWith("file:") || link.startsWith("\\\\") || link.includes(".exe") || link.includes(".bat") || link.includes(".cmd") || link.includes(".vbs") || link.includes(".ps1")) {
            console.warn(`[SECURITY] Removed dangerous hyperlink: ${link.substring(0, 80)}`);
            cell.value = String(cell.value.text || cell.value.hyperlink || "");
          }
        }
      });
    }

    if (worksheet.model && worksheet.model.drawing) {
      delete worksheet.model.drawing;
    }
  }
}

export async function scanUploadedFile(
  filePath: string,
  originalName: string,
  declaredMime: string
): Promise<SecurityScanResult> {
  const extCheck = checkDangerousExtension(originalName);
  if (!extCheck.safe) {
    safeDeleteFile(filePath);
    return extCheck;
  }

  const magicCheck = validateMagicBytes(filePath, declaredMime);
  if (!magicCheck.safe) {
    safeDeleteFile(filePath);
    return magicCheck;
  }

  const clamResult = await scanWithClamAV(filePath);
  if (!clamResult.safe) {
    safeDeleteFile(filePath);
    return clamResult;
  }

  return { safe: true };
}

export async function scanMultipleFiles(
  files: Express.Multer.File[]
): Promise<{ safe: boolean; failedFile?: string; reason?: string; layer?: string }> {
  for (const file of files) {
    const result = await scanUploadedFile(file.path, file.originalname, file.mimetype);
    if (!result.safe) {
      for (const f of files) {
        if (f.path !== file.path) safeDeleteFile(f.path);
      }
      return { safe: false, failedFile: file.originalname, reason: result.reason, layer: result.layer };
    }
  }
  return { safe: true };
}

function safeDeleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err: any) {
    console.error("[SECURITY] Failed to delete unsafe file:", err.message);
  }
}

let _clamAvReady = false;
export function checkClamAvStatus(): { available: boolean; dbPath: string } {
  if (!_clamAvReady) {
    _clamAvReady = fs.existsSync(path.join(CLAMAV_DB_DIR, "main.cvd")) || fs.existsSync(path.join(CLAMAV_DB_DIR, "main.cld"));
  }
  return { available: _clamAvReady, dbPath: CLAMAV_DB_DIR };
}
