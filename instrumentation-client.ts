import { initBotId } from "botid/client/core";

// Vercel BotID: the page attaches its verification headers to requests that can start an LLM call,
// and /api/edition checks them (checkBotId) before writing anything.
initBotId({
  protect: [{ path: "/api/edition", method: "POST" }],
});
