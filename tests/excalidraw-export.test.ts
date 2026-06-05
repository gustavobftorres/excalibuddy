import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExcalidrawExport,
  downloadExcalidrawFile,
  getExportableElementCount,
} from "../src/export/excalidraw-file";

const rectangle = {
  id: "rect-1",
  type: "rectangle",
  x: 10,
  y: 20,
  width: 120,
  height: 80,
  isDeleted: false,
};

test("buildExcalidrawExport creates a native Excalidraw file payload", () => {
  const result = buildExcalidrawExport({
    elements: [rectangle],
    appState: {
      name: "Checkout flow",
      viewBackgroundColor: "#ffffff",
      gridSize: 20,
      theme: "light",
      collaborators: new Map([["user-1", { username: "Ada" }]]),
      openSidebar: { name: "library", tab: "library" },
    },
    files: {
      image1: {
        id: "image1",
        dataURL: "data:image/png;base64,abc",
        mimeType: "image/png",
        created: 1,
        lastRetrieved: 1,
      },
    },
    now: () => new Date("2026-06-05T12:34:56.000Z"),
  });

  assert.equal(result.filename, "checkout-flow-2026-06-05.excalidraw");
  assert.equal(result.mimeType, "application/vnd.excalidraw+json");
  assert.deepEqual(JSON.parse(result.contents), {
    type: "excalidraw",
    version: 2,
    source: "https://github.com/gustavobftorres/excalibuddy",
    elements: [rectangle],
    appState: {
      name: "Checkout flow",
      viewBackgroundColor: "#ffffff",
      gridSize: 20,
      theme: "light",
    },
    files: {
      image1: {
        id: "image1",
        dataURL: "data:image/png;base64,abc",
        mimeType: "image/png",
        created: 1,
        lastRetrieved: 1,
      },
    },
  });
});

test("buildExcalidrawExport rejects empty exports", () => {
  assert.throws(
    () =>
      buildExcalidrawExport({
        elements: [],
        appState: { name: "Empty" },
        files: {},
        now: () => new Date("2026-06-05T12:34:56.000Z"),
      }),
    /Cannot export an empty canvas/
  );
});

test("buildExcalidrawExport falls back to a dated filename when the canvas name is missing", () => {
  const result = buildExcalidrawExport({
    elements: [rectangle],
    appState: {},
    files: {},
    now: () => new Date("2026-06-05T12:34:56.000Z"),
  });

  assert.equal(result.filename, "excalibuddy-diagram-2026-06-05.excalidraw");
});

test("getExportableElementCount ignores deleted elements", () => {
  assert.equal(
    getExportableElementCount([
      rectangle,
      { id: "deleted-1", type: "ellipse", isDeleted: true },
    ]),
    1
  );
});

test("downloadExcalidrawFile creates and revokes an object URL", () => {
  const clicks: string[] = [];
  const revoked: string[] = [];
  const anchor = {
    href: "",
    download: "",
    click() {
      clicks.push(`${this.download}:${this.href}`);
    },
  };

  downloadExcalidrawFile(
    {
      filename: "checkout-flow-2026-06-05.excalidraw",
      contents: "{\"type\":\"excalidraw\"}",
      mimeType: "application/vnd.excalidraw+json",
    },
    {
      createObjectURL(blob) {
        assert.equal(blob.type, "application/vnd.excalidraw+json");
        return "blob:test-url";
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
      createAnchor() {
        return anchor;
      },
    }
  );

  assert.deepEqual(clicks, ["checkout-flow-2026-06-05.excalidraw:blob:test-url"]);
  assert.deepEqual(revoked, ["blob:test-url"]);
});
