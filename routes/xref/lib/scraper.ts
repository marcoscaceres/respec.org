// Reads and parses definition data files from webref repository and writes:
// - xref.json containing parsed and formatted data by term
// - specs.json having data by spec shortname
// - specmap.json having spec details

import path from "path";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";

import { Definition as InputDfn, DfnsJSON, SpecsJSON } from "webref";

import { SUPPORTED_TYPES, CSS_TYPES_INPUT } from "./constants.js";
import { uniq } from "./utils.js";
import { Store } from "./store.js";
import { env } from "../../../utils/misc.js";
import sh from "../../../utils/sh.js";

const DATA_DIR = env("DATA_DIR");
const INPUT_REPO_SRC = "https://github.com/w3c/webref.git";
const INPUT_REPO_NAME = "webref";

const INPUT_DIR_BASE = path.join(DATA_DIR, INPUT_REPO_NAME, "ed");
const SPECS_JSON = path.resolve(INPUT_DIR_BASE, "./index.json");

const OUT_DIR_BASE = path.join(DATA_DIR, "xref");
const OUTFILE_BY_TERM = path.resolve(OUT_DIR_BASE, "./xref.json");
const OUTFILE_BY_SPEC = path.resolve(OUT_DIR_BASE, "./specs.json");
const OUTFILE_SPECMAP = path.resolve(OUT_DIR_BASE, "./specmap.json");

type ParsedDataEntry = ReturnType<typeof parseData>[0];

interface DataByTerm {
  [term: string]: Omit<ParsedDataEntry, "term" | "isExported">[];
}
interface DataBySpec {
  [shortname: string]: Omit<ParsedDataEntry, "shortname" | "isExported">[];
}

const defaultOptions = { forceUpdate: false };
type Options = typeof defaultOptions;

export default async function main(options: Partial<Options> = {}) {
  options = { ...defaultOptions, ...options } as Options;
  const hasUpdated = await updateInputSource();
  if (!hasUpdated && !options.forceUpdate) {
    console.log("Nothing to update");
    return false;
  }

  const { specMap, dfnSources } = await getAllData();

  const dataByTerm: DataByTerm = Object.create(null);
  const dataBySpec: DataBySpec = Object.create(null);
  console.log(`Processing ${dfnSources.length} files...`);
  for (const source of dfnSources) {
    try {
      const terms = parseData(source);
      updateDataByTerm(terms, dataByTerm);
      updateDataBySpec(terms, dataBySpec);
    } catch (error) {
      console.error(`Error while processing ${source.spec}`);
      throw error;
    }
  }

  console.log("Writing processed data files...");
  await mkdir(OUT_DIR_BASE, { recursive: true });
  await Promise.all([
    writeFile(OUTFILE_BY_TERM, JSON.stringify(dataByTerm, null, 2)),
    writeFile(OUTFILE_BY_SPEC, JSON.stringify(dataBySpec, null, 2)),
    writeFile(OUTFILE_SPECMAP, JSON.stringify(specMap, null, 2)),
  ]);
  return true;
}

async function updateInputSource() {
  await mkdir(DATA_DIR, { recursive: true });
  const shouldClone = !existsSync(INPUT_DIR_BASE);

  const command = shouldClone
    ? `git clone ${INPUT_REPO_SRC} ${INPUT_REPO_NAME}`
    : `git pull`;
  const cwd = shouldClone ? DATA_DIR : INPUT_DIR_BASE;

  const stdout = await sh(command, { output: "stream", cwd });
  const hasUpdated = !stdout.includes("Already up to date");
  return hasUpdated;
}

/**
 * Parse and format the contents of webref dfn files
 *
 * @param source content of an dfns data file
 */
function parseData(source: DfnsJSON) {
  const { dfns, spec, series, url } = source;
  const specMetaData = { spec, shortname: series, url };
  const termData = [];
  for (const dfn of dfns) {
    for (const term of dfn.linkingText) {
      const mapped = mapDefinition(dfn, term, specMetaData);
      termData.push(mapped);
    }
  }

  const filtered = termData.filter(
    term => term.isExported && SUPPORTED_TYPES.has(term.type),
  );

  return uniq(filtered);
}

function mapDefinition(
  dfn: InputDfn,
  term: string,
  spec: Record<"spec" | "shortname" | "url", string>,
) {
  const normalizedType = CSS_TYPES_INPUT.has(dfn.type)
    ? `css-${dfn.type}`
    : dfn.type;
  return {
    term: normalizeTerm(term, normalizedType),
    isExported: dfn.access === "public",
    type: normalizedType,
    spec: spec.spec.toLowerCase(),
    shortname: spec.shortname.toLowerCase(),
    status: "current",
    uri: dfn.href.replace(spec.url, ""), // This is full URL to term here
    normative: !dfn.informative,
    for: dfn.for.length > 0 ? dfn.for : undefined,
  };
}

function updateDataByTerm(terms: ParsedDataEntry[], data: DataByTerm) {
  for (const { term, isExported, ...termData } of terms) {
    if (!data[term]) data[term] = [];
    data[term].push(termData);

    if (termData.type === "method" && /\(.+\)/.test(term)) {
      // add another entry without the arguments
      const methodWithoutArgs = term.replace(/\(.+\)/, "()");
      if (!data[methodWithoutArgs]) data[methodWithoutArgs] = [];
      data[methodWithoutArgs].push(termData);
    }
  }
}

function updateDataBySpec(terms: ParsedDataEntry[], data: DataBySpec) {
  for (const { shortname, isExported, ...termData } of terms) {
    if (!data[shortname]) data[shortname] = [];
    data[shortname].push(termData);
  }
}

function normalizeTerm(term: string, type: string) {
  if (type === "enum-value") {
    return term.replace(/^"|"$/g, "");
  }
  if (type === "method" && !term.endsWith(")")) {
    return term + "()";
  }
  if (type === "dfn") {
    return term.toLowerCase();
  }
  return term;
}

async function getAllData() {
  console.log(`Getting data from ${SPECS_JSON}`);
  const urlFileContent = await readJSON(SPECS_JSON);
  const data: SpecsJSON[] = urlFileContent.results;

  const specMap: Store["specmap"] = Object.create(null);
  const specUrls = new Set<string>();
  const dfnSources: DfnsJSON[] = [];

  for (const entry of data) {
    specUrls.add(entry.nightly.url);
    if (entry.release?.url) specUrls.add(entry.release.url);
    if (entry.dfns) {
      const dfnsData = await readJSON(path.join(INPUT_DIR_BASE, entry.dfns));
      const dfns: InputDfn[] = dfnsData.dfns;
      dfnSources.push({
        series: entry.series.shortname,
        spec: entry.shortname,
        url: entry.nightly.url,
        dfns,
      });
    }

    specMap[entry.shortname.toLowerCase()] = {
      url: entry.nightly.url || entry.release?.url || entry.url,
      title: entry.title,
      shortname: entry.series.shortname.toLowerCase(),
    };
  }

  return { specMap, dfnSources };
}

async function readJSON(filePath: string) {
  const text = await readFile(filePath, "utf-8");
  return JSON.parse(text);
}
