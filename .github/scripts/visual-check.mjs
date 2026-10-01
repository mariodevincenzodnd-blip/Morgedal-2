import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:4173";
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ["index.html"];
const outDir = process.env.VISUAL_OUT_DIR || "visual-report";
const authStub = process.env.VISUAL_AUTH_STUB !== "0" && /^http:\/\/127\\.0\\.0\\.1(?::\\d+)?$/i.test(new URL(baseUrl).origin);

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = [];

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

for (const target of targets) {
  const normalized = target.replace(/^\.\//, "").replace(/^\//, "");
  const url = `${baseUrl}/${normalized}`;

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });

    if (authStub) {
      await context.addInitScript(() => {
        try {
          sessionStorage.setItem(
            "morgedal-google-token-v4-shared",
            JSON.stringify({
              token: "visual-ci-token",
              expiresAt: Date.now() + 60 * 60 * 1000,
            })
          );
        } catch {}

        const realFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const url =
            typeof input === "string"
              ? input
              : input && typeof input.url === "string"
                ? input.url
                : "";

          if (url.includes("https://www.googleapis.com/oauth2/v3/userinfo")) {
            return new Response(
              JSON.stringify({ email: "mariodevincenzodnd@gmail.com" }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          if (url.includes("https://www.googleapis.com/drive/")) {
            return new Response("{}", {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          return realFetch(input, init);
        };
      });
    }

    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const requestFailures = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("requestfailed", (req) => {
      requestFailures.push({
        url: req.url(),
        error: req.failure()?.errorText || "unknown",
      });
    });

    let status = null;
    let navigationError = null;

    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      status = response?.status() ?? null;
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(1200);
    } catch (err) {
      navigationError = String(err);
    }

    const metrics = await page
      .evaluate(() => ({
        title: document.title,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        bodyTextLength: document.body?.innerText?.length || 0,
      }))
      .catch(() => null);

    const safeName = normalized
      .replace(/\.html$/i, "")
      .replace(/[^a-z0-9_-]+/gi, "_") || "index";

    const screenshot = path.join(outDir, `${safeName}__${viewport.name}.jpg`);
    await page
      .screenshot({
        path: screenshot,
        fullPage: true,
        type: "jpeg",
        quality: 82,
      })
      .catch(() => {});

    report.push({
      target: normalized,
      url,
      viewport,
      status,
      navigationError,
      metrics,
      horizontalOverflow:
        metrics ? metrics.scrollWidth > metrics.clientWidth + 2 : null,
      consoleErrors,
      pageErrors,
      requestFailures,
      screenshot,
    });

    await context.close();
  }
}

await browser.close();
await fs.writeFile(
  path.join(outDir, "report.json"),
  JSON.stringify(report, null, 2),
  "utf8"
);

const hardFailures = report.filter(
  (entry) =>
    entry.navigationError ||
    (typeof entry.status === "number" && entry.status >= 400) ||
    !entry.metrics ||
    entry.metrics.bodyTextLength === 0
);

console.log(JSON.stringify(report, null, 2));

if (hardFailures.length) {
  console.error(`Visual check failed for ${hardFailures.length} viewport(s).`);
  process.exit(1);
}
