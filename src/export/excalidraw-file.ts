const EXCALIBUDDY_SOURCE = "https://github.com/gustavobftorres/excalibuddy";
const EXCALIDRAW_MIME_TYPE = "application/vnd.excalidraw+json";

type JsonObject = Record<string, unknown>;

interface DownloadAnchor {
  href: string;
  download: string;
  click: () => void;
}

export interface ExcalidrawExportInput {
  elements: readonly unknown[];
  appState: JsonObject;
  files: JsonObject;
  now?: () => Date;
}

export interface ExcalidrawExportFile {
  filename: string;
  contents: string;
  mimeType: string;
}

export interface DownloadDependencies {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createAnchor: () => DownloadAnchor;
}

const APP_STATE_EXPORT_KEYS = [
  "name",
  "viewBackgroundColor",
  "gridSize",
  "theme",
  "currentItemStrokeColor",
  "currentItemBackgroundColor",
  "currentItemFillStyle",
  "currentItemStrokeWidth",
  "currentItemStrokeStyle",
  "currentItemRoughness",
  "currentItemOpacity",
  "currentItemFontFamily",
  "currentItemFontSize",
  "currentItemTextAlign",
  "currentItemStartArrowhead",
  "currentItemEndArrowhead",
  "scrollX",
  "scrollY",
  "zoom",
] as const;

function isDeletedElement(element: unknown): boolean {
  return Boolean(
    element &&
      typeof element === "object" &&
      "isDeleted" in element &&
      (element as { isDeleted?: unknown }).isDeleted === true
  );
}

export function getExportableElementCount(elements: readonly unknown[]): number {
  return elements.filter((element) => !isDeletedElement(element)).length;
}

function getExportableElements(elements: readonly unknown[]): readonly unknown[] {
  return elements.filter((element) => !isDeletedElement(element));
}

function buildExportAppState(appState: JsonObject): JsonObject {
  const exported: JsonObject = {};
  for (const key of APP_STATE_EXPORT_KEYS) {
    if (appState[key] !== undefined) exported[key] = appState[key];
  }
  return exported;
}

function slugifyFilenamePart(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildExcalidrawExport({
  elements,
  appState,
  files,
  now = () => new Date(),
}: ExcalidrawExportInput): ExcalidrawExportFile {
  const exportableElements = getExportableElements(elements);
  if (exportableElements.length === 0) {
    throw new Error("Cannot export an empty canvas");
  }

  const exportedAppState = buildExportAppState(appState);
  const filenameBase = slugifyFilenamePart(exportedAppState.name) || "excalibuddy-diagram";
  const filename = `${filenameBase}-${formatDate(now())}.excalidraw`;
  const payload = {
    type: "excalidraw",
    version: 2,
    source: EXCALIBUDDY_SOURCE,
    elements: exportableElements,
    appState: exportedAppState,
    files,
  };

  return {
    filename,
    contents: `${JSON.stringify(payload, null, 2)}\n`,
    mimeType: EXCALIDRAW_MIME_TYPE,
  };
}

export function downloadExcalidrawFile(
  file: ExcalidrawExportFile,
  dependencies: DownloadDependencies = {
    createObjectURL: (blob) => window.URL.createObjectURL(blob),
    revokeObjectURL: (url) => window.URL.revokeObjectURL(url),
    createAnchor: () => document.createElement("a"),
  }
): void {
  const blob = new Blob([file.contents], { type: file.mimeType });
  const url = dependencies.createObjectURL(blob);
  const anchor = dependencies.createAnchor();
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  dependencies.revokeObjectURL(url);
}
