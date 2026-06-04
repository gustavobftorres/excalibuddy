<h1 align="center">
  Excalibuddy
  <img src="./assets/excalilogo.png" alt="Excalibuddy logo" width="48" />
</h1>

AI Agent to build native diagrams on Excalidraw, all by prompting and giving life to your ideas.

A Cloudflare Workers agent that controls an Excalidraw canvas through tool calls, measuring quality it with evals, and improved by the use of many AI tools (context engineering, better tools, RAG, generative UI, human-in-the-loop, planning, data flywheel).

Build based on [AI Engineering Fundamentals](https://frontendmasters.com/courses/ai-engineering/)

![The diagram design tool](./assets/screenshot.png)

## Setup

### 1. Clone and install

```bash
git clone <this repo url>
cd intro-ai-engineering
npm install
```

### 2. Create accounts

You need accounts at four services.

| Service | Why | Cost | Credit card required? |
|---|---|---|---|
| **OpenAI** | LLM provider for the agent | A few cents for the whole usage | **Yes** |
| **Upstash Vector** | Vector store for RAG | Free tier, very generous | No |
| **Braintrust** | Eval platform | Free tier | No |
| **Tavily** | Web search API for the agent's `searchWeb` tool | Free tier, 1000 searches/month | No |

#### OpenAI

1. Sign up at [platform.openai.com](https://platform.openai.com).
2. Add a payment method. The usage costs pennies but OpenAI requires a card on file before issuing API keys.
3. Create an API key under **API keys**. Save it for the next step.

#### Upstash Vector

1. Sign up at [upstash.com](https://upstash.com). No credit card needed.
2. Go to **Vector** in the console and click **Create Index**.
3. Pick any embedding model from the dropdown — `mixedbread-ai/mxbai-embed-large-v1` is a good default. The model is hosted by Upstash, which is what lets the embed script and the agent skip the embedding step entirely.
4. Pick a region close to you. Free tier is fine.
5. After creation, the index page shows `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN`. Save both.

#### Braintrust

1. Sign up at [braintrust.dev](https://braintrust.dev). No credit card needed.
2. Create an API key from settings. Save it.

#### Tavily

1. Sign up at [tavily.com](https://tavily.com). No credit card needed.
2. Get your API key from the dashboard. Save it.

### 3. Configure environment variables

Create `.dev.vars` at the project root:

```
OPENAI_API_KEY=sk-...
UPSTASH_VECTOR_REST_URL=https://...upstash.io
UPSTASH_VECTOR_REST_TOKEN=...
BRAINTRUST_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

The Worker reads from this file via `wrangler dev` automatically. Node scripts (`npm run embed`, `npm run eval`) read it via `dotenv-cli`.

### 4. Deploy

The frontend can be deployed to Vercel, but the agent runtime must run on
Cloudflare Workers because it depends on Cloudflare Agents and Durable Objects.

Deploy the Worker:

```bash
npx wrangler deploy
```

Configure the same Worker secrets in Cloudflare:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put UPSTASH_VECTOR_REST_URL
npx wrangler secret put UPSTASH_VECTOR_REST_TOKEN
npx wrangler secret put TAVILY_API_KEY
```

Then set this Vercel environment variable for the frontend build:

```bash
VITE_AGENT_HOST=<your-worker-host>
```

For example, use `ai-design-tool.<your-subdomain>.workers.dev` or a custom
Cloudflare Worker domain. Do not include `/agents/design-agent`; the client
library adds that path.


## Tech stack

- **Runtime**: Node + Cloudflare Workers (local via `wrangler dev`, production via `wrangler deploy`)
- **Frontend**: Vite + React + Excalidraw
- **Agent**: AI SDK + Cloudflare Agents SDK (Durable Objects, `useAgentChat`)
- **Vector store**: Upstash Vector 
- **Evals**: Braintrust
- **Web search**: Tavily 

Everything runs locally for development. In production, Vercel serves the static
frontend and Cloudflare Workers hosts the agent backend.
