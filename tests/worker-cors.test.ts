import test from "node:test";
import assert from "node:assert/strict";

import { getCorsHeaders } from "../src/cors";

test("getCorsHeaders allows the production excalibuddy domain", () => {
  const headers = getCorsHeaders(
    new Request("https://api.excalibuddy.xyz/api/feedback", {
      headers: { Origin: "https://excalibuddy.xyz" },
    }),
    {} as never
  ) as Record<string, string>;

  assert.equal(headers["Access-Control-Allow-Origin"], "https://excalibuddy.xyz");
  assert.equal(headers.Vary, "Origin");
});
