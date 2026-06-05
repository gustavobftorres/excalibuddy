import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ExportDiagramButton from "../src/components/export/ExportDiagramButton";

test("ExportDiagramButton renders the primary export action", () => {
  const html = renderToStaticMarkup(
    React.createElement(ExportDiagramButton, {
      disabled: false,
      status: "idle",
      onExport: () => undefined,
    })
  );

  assert.match(html, /Export/);
  assert.match(html, /Download native Excalidraw file/);
  assert.doesNotMatch(html, /disabled=""/);
});

test("ExportDiagramButton disables export when no diagram is available", () => {
  const html = renderToStaticMarkup(
    React.createElement(ExportDiagramButton, {
      disabled: true,
      status: "idle",
      onExport: () => undefined,
    })
  );

  assert.match(html, /disabled=""/);
  assert.match(html, /Create a diagram before exporting/);
});

test("ExportDiagramButton renders busy and result statuses", () => {
  const exporting = renderToStaticMarkup(
    React.createElement(ExportDiagramButton, {
      disabled: false,
      status: "exporting",
      onExport: () => undefined,
    })
  );
  const success = renderToStaticMarkup(
    React.createElement(ExportDiagramButton, {
      disabled: false,
      status: "success",
      onExport: () => undefined,
    })
  );
  const error = renderToStaticMarkup(
    React.createElement(ExportDiagramButton, {
      disabled: false,
      status: "error",
      onExport: () => undefined,
    })
  );

  assert.match(exporting, /Preparing/);
  assert.match(success, /Downloaded/);
  assert.match(error, /Export failed/);
});
