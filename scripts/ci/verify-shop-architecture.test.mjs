import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Shop commerce architecture SSOT", () => {
  it("links boundary doc from docs index and records D24", () => {
    const readme = readFileSync(join(root, "docs/README.md"), "utf8");
    assert.match(readme, /10-shop-commerce-boundary\.md/);

    const decisions = readFileSync(join(root, "docs/architecture/02-decisions.md"), "utf8");
    assert.match(decisions, /## D24\. Shop commerce API/);
    assert.match(decisions, /10-shop-commerce-boundary\.md/);

    const boundary = readFileSync(
      join(root, "docs/architecture/10-shop-commerce-boundary.md"),
      "utf8",
    );
    assert.match(boundary, /apps\/shop-api/);
    assert.match(boundary, /packages\/shop-domain/);
    assert.match(boundary, /shop_edition/);
  });

  it("aligns MVP spec with artwork/edition foundation slice", () => {
    const mvp = readFileSync(join(root, "docs/runbooks/shop-mvp-spec.md"), "utf8");
    assert.match(mvp, /import_key/);
    assert.match(mvp, /10 \/ 10 \/ 4|10.*10.*4/);
    assert.match(mvp, /Foundation \(implemented/);
    assert.match(mvp, /apps\/shop-api/);
  });

  it("documents Shop storefront SOLID layering and UI gates", () => {
    const storefront = readFileSync(join(root, "docs/ui/shop-storefront-architecture.md"), "utf8");
    assert.match(storefront, /lib\/home\/\*\.vm\.ts/);
    assert.match(storefront, /PLAYWRIGHT_E2E/);

    const shopPkg = readFileSync(join(root, "apps/shop/package.json"), "utf8");
    assert.match(shopPkg, /test:e2e:a11y/);
    assert.match(shopPkg, /"test:e2e"/);

    assert.ok(
      readFileSync(join(root, "apps/shop/src/lib/home/home-page.vm.ts"), "utf8").includes(
        "buildHomePageViewModel",
      ),
    );
    assert.ok(readFileSync(join(root, "apps/shop/playwright.config.ts"), "utf8").includes("3020"));
    assert.match(
      readFileSync(join(root, "apps/shop/e2e/shop-viewport-audit.spec.ts"), "utf8"),
      /horizontal overflow/,
    );
  });

  it("references ecosystem boundary for Shop chrome", () => {
    const storefront = readFileSync(join(root, "docs/ui/shop-storefront-architecture.md"), "utf8");
    assert.match(storefront, /11-lax-ecosystem-boundary/);
  });

  it("documents multi-product UI stack and Shop selective @auction/ui", () => {
    const designSystem = readFileSync(join(root, "docs/DESIGN_SYSTEM.md"), "utf8");
    assert.match(designSystem, /## Multi-product UI stack/);
    assert.match(designSystem, /shop-account-shell/);

    const accountShell = readFileSync(
      join(root, "apps/shop/src/components/account/shop-account-shell.tsx"),
      "utf8",
    );
    assert.match(accountShell, /@auction\/ui\/components\/(alert|button)/);

    const shopBase = readFileSync(join(root, "apps/shop/src/app/base.css"), "utf8");
    assert.match(shopBase, /shadcn\/ui variable bridge/);
    for (const concern of [
      "header",
      "home",
      "catalogue",
      "account",
      "commerce",
      "state",
      "footer",
    ]) {
      assert.ok(
        existsSync(join(root, `apps/shop/src/app/${concern}.css`)),
        `Shop ${concern} styles must remain a separate concern module`,
      );
    }

    const nextConfig = readFileSync(join(root, "apps/shop/next.config.ts"), "utf8");
    assert.match(nextConfig, /@auction\/ui/);
    assert.match(nextConfig, /@auction\/marketing-ui/);

    const shopHomeCss = readFileSync(join(root, "apps/shop/src/app/home.css"), "utf8");
    assert.doesNotMatch(shopHomeCss, /shop-home__card-interactive/);

    assert.ok(
      readFileSync(
        join(root, "apps/shop/src/components/home/cards/print-card.tsx"),
        "utf8",
      ).includes("@auction/marketing-ui"),
    );
  });

  it("keeps MVP navigation honest and artwork routes resilient", () => {
    const navigationSources = [
      "apps/shop/src/content/home-marketing.ts",
      "apps/shop/src/content/footer-nav.config.ts",
      "apps/shop/src/components/header/header-nav.config.ts",
    ];
    for (const source of navigationSources) {
      assert.doesNotMatch(
        readFileSync(join(root, source), "utf8"),
        /href\s*[:=]\s*["']#["']/,
        `${source} must not expose dead root-fragment links`,
      );
    }

    for (const state of ["error.tsx", "not-found.tsx"]) {
      assert.ok(
        readFileSync(join(root, `apps/shop/src/app/artworks/[slug]/${state}`), "utf8").length > 0,
      );
    }
    assert.equal(
      existsSync(join(root, "apps/shop/src/app/artworks/[slug]/loading.tsx")),
      false,
      "Artwork details must not stream a JS-dependent loading boundary",
    );

    const browserGate = readFileSync(join(root, "apps/shop/e2e/home.spec.ts"), "utf8");
    assert.match(browserGate, /passes whole-page axe/);
    assert.match(browserGate, /mobile menu exposes account actions/);
    assert.match(browserGate, /visible without JavaScript/);
  });

  it("routes Shop triple changes through immutable staging cutover", () => {
    const deployTest = readFileSync(join(root, ".github/workflows/app-deploy-test.yml"), "utf8");
    assert.match(deployTest, /apps\/shop apps\/shop-identity apps\/shop-api/);
    assert.match(deployTest, /test-shop\.lax\.bid\/health\/ready/);
    assert.match(deployTest, /select\(\.name == "shop"\)/);

    const shopAcceptance = readFileSync(
      join(root, ".github/workflows/shop-staging-acceptance.yml"),
      "utf8",
    );
    assert.match(shopAcceptance, /PLAYWRIGHT_E2E: "1"/);
    assert.match(shopAcceptance, /seed_catalogue/);
    assert.match(shopAcceptance, /shop_sha:/);
    assert.match(shopAcceptance, /dependencies\.shopIdentity\.status == "ok"/);
    assert.match(shopAcceptance, /test "\$code" = "400"/);
    assert.match(shopAcceptance, /if-no-files-found: warn/);
    assert.match(shopAcceptance, /home-catalogue\.spec\.ts/);
    assert.match(shopAcceptance, /Shop SEO smoke \(no browser\)/);
    assert.match(shopAcceptance, /\/robots\.txt/);
    assert.match(shopAcceptance, /e2e\/theme-audit\.spec\.ts/);
    assert.match(shopAcceptance, /visible without JavaScript\|theme/);
    assert.doesNotMatch(shopAcceptance, /shop-viewport-audit\.spec\.ts/);

    const recovery = readFileSync(
      join(root, ".github/workflows/staging-recovery-test.yml"),
      "utf8",
    );
    assert.match(recovery, /shop-staging-acceptance\.yml/);
    assert.match(recovery, /shop_acceptance_after_rehearsal/);

    const buildImages = readFileSync(join(root, ".github/workflows/build-images.yml"), "utf8");
    assert.match(buildImages, /\["shop-identity","shop","shop-api"\]/);
  });

  it("enforces Shop browser, media, SEO, and asset contracts", () => {
    const workflow = readFileSync(join(root, ".github/workflows/e2e-pr.yml"), "utf8");
    assert.match(workflow, /Run Shop accessibility and viewport gates/);
    assert.match(workflow, /e2e\/home\.spec\.ts/);
    assert.match(workflow, /e2e\/theme-audit\.spec\.ts/);
    assert.match(workflow, /e2e\/shop-viewport-audit\.spec\.ts/);
    assert.doesNotMatch(workflow, /seed:catalogue/);
    assert.doesNotMatch(workflow, /PLAYWRIGHT_VISUAL: "1"/);

    const mediaMigration = readFileSync(
      join(root, "packages/db/drizzle/0163_shop_artwork_media.sql"),
      "utf8",
    );
    assert.match(mediaMigration, /primary_image_url/);

    const curationMigration = readFileSync(
      join(root, "packages/db/drizzle/0164_shop_storefront_curation.sql"),
      "utf8",
    );
    assert.match(curationMigration, /shop_home_placement/);
    assert.match(
      readFileSync(join(root, "packages/shop-contracts/src/artwork-public.ts"), "utf8"),
      /imageUrl/,
    );

    assert.ok(readFileSync(join(root, "apps/shop/src/app/robots.ts"), "utf8").length > 0);
    assert.ok(readFileSync(join(root, "apps/shop/src/app/sitemap.ts"), "utf8").length > 0);
    assert.ok(readFileSync(join(root, "scripts/ci/verify-shop-assets.mjs"), "utf8").length > 0);
  });

  it("keeps Shop chrome icons on Lucide via @auction/marketing-ui", () => {
    const shopPublic = join(root, "apps/shop/public/shop");
    const svgAssets = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".svg")) svgAssets.push(full);
      }
    };
    walk(shopPublic);
    const brandLogos = svgAssets.filter((file) => /lax-shop-logo(?:-light)?\.svg$/.test(file));
    const iconSvgs = svgAssets.filter((file) => !/lax-shop-logo(?:-light)?\.svg$/.test(file));
    assert.equal(brandLogos.length > 0, true, "Shop must ship lax-shop-logo.svg");
    assert.equal(
      iconSvgs.length,
      0,
      `Shop public must not ship SVG icon assets (use @auction/marketing-ui): ${iconSvgs.join(", ")}`,
    );

    const shopSrc = join(root, "apps/shop/src");
    const sourceFiles = [];
    const collectSources = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) collectSources(full);
        else if (/\.(tsx?|jsx?)$/.test(entry.name)) sourceFiles.push(full);
      }
    };
    collectSources(shopSrc);
    for (const file of sourceFiles) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(
        text,
        /from\s+["']lucide-react["']/,
        `${file} must import icons from @auction/marketing-ui, not lucide-react directly`,
      );
    }

    const chromeModulePaths = [
      "apps/shop/src/components/header/shop-header.client.tsx",
      "apps/shop/src/components/header/shop-header-account-utility.tsx",
      "apps/shop/src/components/header/shop-theme-toggle.tsx",
      "apps/shop/src/components/header/shop-mega-menu.client.tsx",
      "apps/shop/src/components/footer/shop-footer.tsx",
    ];
    const chromeModuleText = chromeModulePaths
      .map((rel) => readFileSync(join(root, rel), "utf8"))
      .join("\n");
    assert.match(chromeModuleText, /@auction\/marketing-ui/);
  });

  it("uses shared media placeholders and status registry (no ad hoc copy or colours)", () => {
    const shopSrc = join(root, "apps/shop/src");
    const sourceFiles = [];
    const collectSources = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) collectSources(full);
        else if (/\.(tsx?|jsx?|css)$/.test(entry.name)) sourceFiles.push(full);
      }
    };
    collectSources(shopSrc);

    const bannedColourRes = [
      /bg-emerald-/,
      /bg-amber-/,
      /text-green-/,
      /text-orange-/,
      /bg-green-/,
    ];
    const placeholderCopyRes = [
      /Image coming soon/i,
      /Portrait coming soon/i,
      /imagery coming soon/i,
    ];

    for (const file of sourceFiles) {
      const rel = file.replace(`${shopSrc}/`, "");
      if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
      const text = readFileSync(file, "utf8");
      for (const re of placeholderCopyRes) {
        assert.doesNotMatch(
          text,
          re,
          `${rel} must use ShopMediaImage placeholders, not inline copy`,
        );
      }
      if (!rel.endsWith(".css")) {
        for (const re of bannedColourRes) {
          assert.doesNotMatch(
            text,
            re,
            `${rel} must use DotStatusPill tones, not hand-rolled Tailwind status colours`,
          );
        }
      }
    }

    assert.ok(
      readFileSync(
        join(root, "apps/shop/src/lib/presenters/shop-status-presentation.ts"),
        "utf8",
      ).includes("DotStatusPillTone"),
    );
    assert.ok(
      readFileSync(
        join(root, "apps/shop/src/components/media/shop-media-image.tsx"),
        "utf8",
      ).includes("@auction/marketing-ui"),
    );
  });
});
