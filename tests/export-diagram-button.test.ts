import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ExportDiagramButton from "../src/components/export/ExportDiagramButton";

test("ExportDiagramButton renders an icon-only export action with an accessible label", () => {
  const html = renderToStaticMarkup(
    React.createElement(ExportDiagramButton, {
      disabled: false,
      status: "idle",
      onExport: () => undefined,
    })
  );

  assert.match(html, /Download native Excalidraw file/);
  assert.match(html, /export-diagram-icon/);
  assert.doesNotMatch(html, />Export</);
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

test("ExportDiagramButton exposes busy and result statuses through the button label", () => {
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
  assert.doesNotMatch(exporting, /export-diagram-status/);
  assert.doesNotMatch(success, /export-diagram-status/);
  assert.doesNotMatch(error, /export-diagram-status/);
});
