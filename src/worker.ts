import { DesignAgent } from "./agent";
import { routeAgentRequest } from "agents";
import { createWorkerFetchHandler, type Env } from "./worker-fetch";

export { DesignAgent };

export default {
  fetch: createWorkerFetchHandler({ routeAgentRequest }),
} satisfies ExportedHandler<Env>;
