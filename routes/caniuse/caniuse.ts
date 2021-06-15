import { Request, Response } from "express";

import { seconds } from "../../utils/misc.js";

import { createResponseBodyHTML, sanitizeBrowsersList } from "./lib/index.js";

type Params = { feature: string };
type Query = { browsers?: string };
type IRequest = Request<Params, any, any, Query>;

export default async function route(req: IRequest, res: Response) {
  const feature = req.params.feature;
  const browsers = sanitizeBrowsersList(req.query.browsers?.split(/,/g) || []);

  const body = await createResponseBodyHTML(feature, browsers);
  if (body === null) {
    res.sendStatus(404);
    return;
  }

  res.set("Cache-Control", `max-age=${seconds("24h")}`);
  res.send(body);
}
