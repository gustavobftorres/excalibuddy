import { tool } from "ai";
import { z } from "zod";

export const requestPlanApproval = tool({
  description:
    "Present the final proposed diagram plan for user approval. Use this only after clarifying uncertainties. Do not call any canvas tool in planning mode.",
  inputSchema: z.object({
    title: z.string(),
    summary: z.string(),
    steps: z.array(z.string()).min(1),
    assumptions: z.array(z.string()),
    questions: z.array(z.string()),
  }),
  strict: true,
  execute: async () => ({ status: "awaiting_user_approval" }),
});
