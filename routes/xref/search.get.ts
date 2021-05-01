import { Request, Response } from "express";
import { seconds } from "../../utils/misc.js";

import { searchOne, Query, Options } from "./lib/search.js";
import { store } from "./lib/store-init.js";

interface QueryParams {
  term: string;
  specs?: string | string[];
  for?: string;
  type?: string | string[];
  query?: boolean;
}
type IRequest = Request<never, any, never, QueryParams>;

export default async function route(req: IRequest, res: Response) {
  const { term, for: forContext } = req.query;
  const specs = splitQueryParam(req.query.specs);
  const types = splitQueryParam(req.query.type)?.flat(2) as Query["types"];

  const query: Query = { term, specs, for: forContext, types, id: undefined };
  const options: Partial<Options> = { fields: [], all: !types || !forContext };

  const result = searchOne(query, store, options);

  res.setHeader("Cache-Control", `max-age=${seconds("30min")}`);
  if (!result.length) {
    res.status(404);
  }
  res.json({
    id: query.id,
    ...(req.query.query ? { query } : undefined),
    result,
  });
}

function splitQueryParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value.map(item => item.split(/,\s*/).filter(s => s));
  }
  if (value) {
    return [value.split(/,\s*/).filter(s => s)];
  }
  return undefined;
}
