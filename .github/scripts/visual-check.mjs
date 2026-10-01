import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:4173";
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ["index.html"];
const outDir = process.env.VISUAL_OUT_DIR || "visual-report";
const authStub = process.env.VISUAL_AUTH_STUB !== "0" && /^http:\/\/127\\.0\\.0\\.1(?::\\d+)?$/i.test(new URL(baseUrl).origin);

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const report = [];

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

for (const target of targets) {
  const normalized = target.replace(/^\.\//, "").replace(/^\//, "");
  const url = `${baseUrl}/${normalized}`;
  const isCharacterSheet = /_Scheda_Interattiva\.html$/i.test(normalized);

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });

    if (authStub) {
      await context.addInitScript(() => {
        const token = {
          token: "visual-ci-token",
          expiresAt: Date.now() + 60 * 60 * 1000,
        };
        try {
          sessionStorage.setItem(
            "morgedal-google-token-v4-shared",
            JSON.stringify(token)
          );
          sessionStorage.setItem(
            "morgedal-google-token-v2",
            JSON.stringify(token)
          );
        } catch {}
      });

      await context.route(
        "https://www.googleapis.com/oauth2/v3/userinfo*",
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ email: "mariodevincenzodnd@gmail.com" }),
          });
        }
      );

      await context.route(
        /https:\/\/www\.googleapis\.com\/drive\//i,
        async (route) => {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: "{}",
          });
        }
      );

      if (isCharacterSheet) {
        await context.route(url, async (route) => {
          const response = await route.fetch();
          let body = await response.text();
          const gateBoot = 'document.addEventListener("DOMContentLoaded", initLock);';
          const bypassBoot = 'document.addEventListener("DOMContentLoaded", ()=>{ try{ setMasterEditorOn(false); }catch(e){} hideLockScreen(); init(); });';

          if (!body.includes(gateBoot)) {
            throw new Error(`Visual auth bypass hook not found in ${normalized}`);
          }

          body = body.replace(gateBoot, bypassBoot);
          await route.fulfill({
            response,
            body,
            headers: {
              ...response.headers(),
              "content-type": "text/html; charset=utf-8",
            },
          });
        });
      }
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
      if (authStub && isCharacterSheet) {
        await page.goto(`${baseUrl}/index.html`, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });

        await page.evaluate(() => {
          const token = {
            token: "visual-ci-token",
            expiresAt: Date.now() + 60 * 60 * 1000,
          };
          sessionStorage.setItem(
            "morgedal-google-token-v4-shared",
            JSON.stringify(token)
          );
          sessionStorage.setItem(
            "morgedal-google-token-v2",
            JSON.stringify(token)
          );
        });
      }

      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      status = response?.status() ?? null;

      if (isCharacterSheet) {
        await page
          .waitForFunction(
            () =>
              document.title.startsWith("Scheda —") &&
              document.getElementById("lock-screen")?.style.display === "none",
            null,
            { timeout: 15_000 }
          )
          .catch(() => {});
      }

      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

      if (/^Ola_Scheda_Interattiva\.html$/i.test(normalized)) {
        const poteriTab = page.locator(".tab-btn").filter({ hasText: "POTERI & RISORSE" }).first();
        if (await poteriTab.count()) {
          await poteriTab.click();
          await page.waitForTimeout(500);
        } else {
          throw new Error("Tab POTERI & RISORSE non trovata nella scheda OLA");
        }

        const ancestrale = page.locator("#anchor-alterazione-ancestrale");
        const dragonide = page.locator("#anchor-alterazione-dragonide");
        if (!(await ancestrale.count()) || !(await dragonide.count())) {
          throw new Error("Macro-riquadri Ancestrale/Dragonide non trovati");
        }

        const pipCounts = async (card) =>
          await card.locator(".slot-lvl .pips").evaluateAll((rows) =>
            rows.map((row) => row.querySelectorAll(".pip").length)
          );

        const expectedTempSlots = [6, 5, 4, 3, 2, 1];
        const ancestralCounts = await pipCounts(ancestrale);
        const dragonideCounts = await pipCounts(dragonide);
        if (JSON.stringify(ancestralCounts) !== JSON.stringify(expectedTempSlots)) {
          throw new Error(`Ancestrale: progressione slot inattesa ${JSON.stringify(ancestralCounts)}`);
        }
        if (JSON.stringify(dragonideCounts) !== JSON.stringify(expectedTempSlots)) {
          throw new Error(`Dragonide: progressione slot inattesa ${JSON.stringify(dragonideCounts)}`);
        }

        const ancestralUsedBefore = await ancestrale.locator(".slot-lvl .pip.used").count();
        const dragonFirstPip = dragonide.locator(".slot-lvl").first().locator(".pip").first();
        await dragonFirstPip.click();
        await page.waitForTimeout(150);

        const ancestralAfterClick = page.locator("#anchor-alterazione-ancestrale");
        const dragonideAfterClick = page.locator("#anchor-alterazione-dragonide");
        const ancestralUsedAfter = await ancestralAfterClick.locator(".slot-lvl .pip.used").count();
        const dragonideUsedAfter = await dragonideAfterClick.locator(".slot-lvl .pip.used").count();

        if (ancestralUsedAfter !== ancestralUsedBefore) {
          throw new Error("Dragonide modifica il pool temporaneo di Ancestrale");
        }
        if (dragonideUsedAfter !== 1) {
          throw new Error(`Dragonide: click slot non registrato correttamente (${dragonideUsedAfter})`);
        }

        await dragonideAfterClick.locator(".slot-lvl").first().locator(".pip").first().click();
        await page.waitForTimeout(150);
        const dragonideUsedReset = await page.locator("#anchor-alterazione-dragonide .slot-lvl .pip.used").count();
        if (dragonideUsedReset !== 0) {
          throw new Error("Dragonide: ripristino del pip di test non riuscito");
        }
      }

      await page.waitForTimeout(1200);
    } catch (err) {
      navigationError = String(err);
    }

    const metrics = await page
      .evaluate(() => {
        const lock = document.getElementById("lock-screen");
        const lockVisible =
          !!lock &&
          getComputedStyle(lock).display !== "none" &&
          getComputedStyle(lock).visibility !== "hidden";

        return {
          title: document.title,
          currentUrl: location.href,
          pathname: location.pathname,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
          bodyTextLength: document.body?.innerText?.length || 0,
          lockVisible,
          lockText: lockVisible ? (lock?.innerText || "").slice(0, 300) : "",
        };
      })
      .catch(() => null);

    const accessGateFailed =
      !!isCharacterSheet &&
      !!metrics &&
      (
        metrics.lockVisible ||
        /\/index\.html$/i.test(metrics.pathname || "") ||
        !String(metrics.title || "").startsWith("Scheda —")
      );

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
      accessGateFailed,
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
    entry.metrics.bodyTextLength === 0 ||
    entry.accessGateFailed
);

console.log(JSON.stringify(report, null, 2));

if (hardFailures.length) {
  console.error(`Visual check failed for ${hardFailures.length} viewport(s).`);
  process.exit(1);
}
