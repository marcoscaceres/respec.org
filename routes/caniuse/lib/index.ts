import * as path from "path";
import { promises as fs } from "fs";

import { html } from "ucontent";

import { BROWSERS, SUPPORT_TITLES } from "./constants.js";
import { env } from "../../../utils/misc.js";
import { MemCache } from "../../../utils/mem-cache.js";
import {
  BrowserVersionData,
  SupportKeys,
  ScraperOutput as Data,
} from "./constants.js";

const DATA_DIR = env("DATA_DIR");

interface Options {
  feature: string;
  browsers?: string | string[];
  versions?: number;
  format?: "html" | "json";
}

interface NormalizedOptions {
  feature: string;
  browsers: string[];
  versions?: number;
  format: "html" | "json";
}

const defaultOptions = {
  browsers: ["chrome", "firefox", "safari", "edge"],
  versions: 4,
};

// Content in this cache is invalidated through `POST /caniuse/update`.
export const cache = new MemCache<Data>(Infinity);

export async function createResponseBody(options: Options) {
  const opts = normalizeOptions(options);

  switch (opts.format) {
    case "json":
      return await createResponseBodyJSON(opts);
    case "html":
    default:
      return await createResponseBodyHTML(opts.feature, opts.browsers);
  }
}

export async function createResponseBodyJSON(options: NormalizedOptions) {
  const { feature, browsers, versions } = options;
  const data = await getData(feature);
  if (!data) {
    return null;
  }

  if (!browsers.length) {
    browsers.push(...Object.keys(data.all));
  }

  const response: Data["all"] = {};
  for (const browser of browsers) {
    const browserData = data.all[browser] || [];
    response[browser] = browserData.slice(0, versions);
  }
  return response;
}

export async function createResponseBodyHTML(
  feature: string,
  browsers: string[],
) {
  const allData = await getData(feature);
  if (!allData) {
    return null;
  }

  if (!browsers.length) {
    browsers.push(...Object.keys(allData.summary));
  }

  const data: Data["summary"] = {};
  for (const browser of browsers) {
    data[browser] = allData.summary[browser] || [];
  }
  return formatAsHTML(feature, data);
}

function normalizeOptions(options: Options): NormalizedOptions {
  const feature = options.feature;
  const browsers = sanitizeBrowsersList(options.browsers);
  const format = options.format === "html" ? "html" : "json";
  // versions is used only with format="json"
  const versions = options.versions || defaultOptions.versions;
  return { feature, versions, browsers, format };
}

export function sanitizeBrowsersList(browsers?: string | string[]) {
  if (!Array.isArray(browsers)) {
    if (browsers === "all") return [];
    return defaultOptions.browsers;
  }
  const filtered = browsers.filter(browser => BROWSERS.has(browser));
  return filtered.length ? filtered : defaultOptions.browsers;
}

async function getData(feature: string) {
  if (cache.has(feature)) {
    return cache.get(feature) as Data;
  }
  const file = path.format({
    dir: path.join(DATA_DIR, "caniuse"),
    name: `${feature}.json`,
  });

  try {
    const str = await fs.readFile(file, "utf8");
    const data: Data = JSON.parse(str);
    cache.set(feature, data);
    return data;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function formatAsHTML(feature: string, data: Data["summary"]): string {
  const getSupportTitle = (keys: SupportKeys) => {
    return keys
      .filter(key => SUPPORT_TITLES.has(key))
      .map(key => SUPPORT_TITLES.get(key)!)
      .join(" ");
  };

  const getClassName = (keys: SupportKeys) => `caniuse-cell ${keys.join(" ")}`;

  const renderLatestVersion = (
    browserName: string,
    [version, supportKeys]: BrowserVersionData,
  ) => {
    const text = `${BROWSERS.get(browserName) || browserName} ${version}`;
    const className = getClassName(supportKeys);
    const title = getSupportTitle(supportKeys);
    return html`<button class="${className}" title="${title}">${text}</button>`;
  };

  const renderOlderVersion = ([version, supportKeys]: BrowserVersionData) => {
    const text = version;
    const className = getClassName(supportKeys);
    const title = getSupportTitle(supportKeys);
    return html`<li class="${className}" title="${title}">${text}</li>`;
  };

  const renderBrowser = (
    browser: string,
    browserData: BrowserVersionData[],
  ) => {
    const [latestVersion, ...olderVersions] = browserData;
    return html`
      <div class="caniuse-browser">
        ${renderLatestVersion(browser, latestVersion)}
        <ul>
          ${olderVersions.map(renderOlderVersion)}
        </ul>
      </div>
    `;
  };

  const browsers = html`${Object.entries(data).map(([browser, browserData]) =>
    renderBrowser(browser, browserData),
  )}`;

  const featureURL = new URL(feature, "https://caniuse.com/").href;
  const moreInfo = html`<a href="${featureURL}">More info</a>`;

  return html`${browsers} ${moreInfo}`.toString();
}
