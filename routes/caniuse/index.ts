import { Router } from "express";
import cors from "cors";
import { Request, Response } from "express";

import authGithubWebhook from "../../utils/auth-github-webhook.js";
import { env, seconds } from "../../utils/misc.js";

import { createResponseBody } from "./lib/index.js";
import updateRoute from "./update.js";
import caniuseRoute from "./caniuse.js";

const caniuse = Router({ mergeParams: true });

caniuse.get("/", cors(), route);
caniuse.get("/:feature", cors(), caniuseRoute);
caniuse.post("/update", authGithubWebhook(env("CANIUSE_SECRET")), updateRoute);

export default caniuse;

interface Query {
  feature: string;
  browsers?: string;
  versions?: string;
  format?: "html" | "json";
}
type IRequest = Request<any, any, any, Query>;

export async function route(req: IRequest, res: Response) {
  const options = {
    feature: req.query.feature,
    browsers: req.query.browsers ? req.query.browsers.split(",") : "default",
    versions: parseInt(req.query.versions || "", 10),
    format: req.query.format,
  };
  if (!options.feature) {
    res.sendStatus(400);
    return;
  }
  if (Number.isNaN(options.versions)) {
    options.versions = 0;
  }
  const body = await createResponseBody(options);
  if (body === null) {
    res.sendStatus(404);
    return;
  }

  res.set("Cache-Control", `max-age=${seconds("24h")}`);
  res.send(body);
}
