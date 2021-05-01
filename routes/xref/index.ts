import path from "path";

import express from "express";
import cors from "cors";
import { Request, Response } from "express";

import authGithubWebhook from "../../utils/auth-github-webhook.js";
import { env, ms } from "../../utils/misc.js";

import { store } from "./lib/store-init.js";
import searchRouteGet from "./search.get.js";
import searchRoutePost from "./search.post.js";
import metaRoute from "./meta.js";
import updateRoute from "./update.js";
import { search, Options, Query } from "./lib/search.js";

const DATA_DIR = env("DATA_DIR");

const xref = express.Router({ mergeParams: true });

xref.options("/", cors({ methods: ["POST"], maxAge: ms("1day") }));
xref.post("/", express.json(), cors(), route);
xref.get("/search", cors(), searchRouteGet);
xref.options("/search", cors({ methods: ["POST"], maxAge: ms("1day") }));
xref.post("/search", express.json(), cors(), searchRoutePost);

xref.get("/meta/:field?", cors(), metaRoute);
xref.post("/update", authGithubWebhook(env("W3C_WEBREF_SECRET")), updateRoute);
xref.use("/data", express.static(path.join(DATA_DIR, "xref")));

export default xref;

interface RequestBody {
  options: Partial<Options>;
  queries: Query[];
  keys: Query[];
}
type IRequest = Request<any, any, RequestBody>;

export function route(req: IRequest, res: Response) {
  const { options } = req.body;
  // req.body.keys for backward compatibility
  const queries = req.body.queries || req.body.keys || [];
  const body = search(queries, store, options);

  const errors = getErrorCount(body.result);
  // add error stats to logs
  Object.assign(res.locals, { errors, queries: queries.length });

  res.json(body);
}

function getErrorCount(results: [string, any[]][]) {
  let errorCount = 0;
  for (const [, entries] of results) {
    if (entries.length !== 1) {
      errorCount++;
    }
  }
  return errorCount;
}
