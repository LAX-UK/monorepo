const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  for (const w of [375, 1440]) {
    const p = await b.newPage({ viewport: { width: w, height: 800 } });
    for (const pos of ["fixed", "sticky"]) {
      await p.goto(`file://${__dirname}/page.html?pos=${pos}`);
      const r = async (s) =>
        p.$eval(s, (e) => {
          const x = e.getBoundingClientRect();
          return [Math.round(x.top), Math.round(x.bottom)];
        });
      const b0 = await r("#b");
      const h0 = await r("#hero");
      await p.screenshot({ path: `sale-${w}-${pos}-top.png` });
      await p.evaluate(() => window.scrollTo(0, document.getElementById("t").offsetTop + 200));
      const b1 = await r("#b");
      const t1 = await r("#t");
      await p.screenshot({ path: `sale-${w}-${pos}-scrolled.png` });
      console.log(
        w,
        pos,
        "scroll0 banner",
        b0,
        "hero",
        h0,
        "| scrolled banner",
        b1,
        "tabs",
        t1,
        "tabs covered:",
        t1[0] < b1[1] && t1[1] > b1[0],
      );
      await p.goto(`file://${__dirname}/page.html?pos=${pos}&page=staff`);
      console.log(
        "   staff",
        pos,
        "banner",
        await r("#b"),
        "staffbar",
        await r("#sb"),
        "docH",
        await p.evaluate(() => document.documentElement.scrollHeight),
      );
      await p.screenshot({ path: `staff-${w}-${pos}.png` });
    }
  }
  await b.close();
})();
