import { tool } from "ai";
import { z } from "zod";

// Client side tool: the browser fulfills this by reading the live Excalidraw
// scene and running the same deterministic hygiene checks used by evals.
export const verifyCanvas = tool({
  description: `Verify the current canvas for visual and structural problems after creating or modifying a diagram. Always pass the user's current request verbatim. Returns deterministic issues such as overlaps, clipped labels, unbound arrows, poor arrow anchors, and disconnected shapes when the request implies a connected diagram.

Example: verifyCanvas({ userRequest: "Draw a login flow from User to API to Database" })`,
  inputSchema: z.object({
    userRequest: z.string().describe("The user's current request, copied verbatim when possible."),
  }),
});
