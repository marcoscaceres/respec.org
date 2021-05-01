import { Request, Response } from "express";

import { searchOne, Query, Options, DataEntry } from "./lib/search.js";
import { Store } from "./lib/store.js";
import { store } from "./lib/store-init.js";

interface RequestBody {
  options: Partial<Options>;
  queries: Query[];
  keys: Query[];
}
type IRequest = Request<never, any, RequestBody>;

export default function route(req: IRequest, res: Response) {
  const { options = {}, queries = [] } = req.body;
  const results = search(queries, store, options);

  Object.assign(res.locals, {
    errors: getErrorCount(results),
    queries: queries.length,
  });
  res.json(results);
}

function getErrorCount(results: ReturnType<typeof search>) {
  return results.filter(({ result }) => result.length !== 1).length;
}

export function search(
  queries: Query[],
  store: Store,
  options: Partial<Options> = {},
): { query?: Query; result: Partial<DataEntry>[] }[] {
  return queries.map(query => {
    const result = searchOne(query, store, options);
    return {
      id: query.id,
      ...(options.query ? { query } : undefined),
      result,
    };
  });
}
