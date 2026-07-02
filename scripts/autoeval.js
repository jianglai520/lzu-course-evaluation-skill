#!/usr/bin/env node
/**
 * LZU Course Evaluation Automation Script
 *
 * Connects to running Edge/Chrome via Chrome DevTools Protocol (CDP).
 * No browser extension needed.
 *
 * Usage:
 *   1. Start browser: msedge.exe --remote-debugging-port=9222
 *   2. Log in to my.lzu.edu.cn, go to: 评教任务 -> 当前评教任务
 *   3. Run: node scripts/autoeval.js
 *
 * Options:
 *   --port=9222     CDP port
 *   --dry-run       List only, no changes
 *   --no-submit     Fill forms, stop before submit
 */

const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '9222', 10);
const DRY = process.argv.includes('--dry-run');
const NO_SUBMIT = process.argv.includes('--no-submit');

let chromium;
try { chromium = require('playwright').chromium; }
catch {
  console.error('Playwright not found. Run: npm install playwright');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function findEvalPage(ctx) {
  const pages = ctx.pages();
  for (const p of pages) {
    const url = p.url();
    if (url.includes('hjjss') || url.includes('jwqe.lzu.edu.cn') || url.includes('评教')) return p;
  }
  for (const p of pages) {
    if (p.url().includes('my.lzu.edu.cn') || p.url().includes('lzu.edu.cn')) return p;
  }
  console.log('Available pages:');
  for (const p of pages) {
    const t = await p.title().catch(() => '?');
    console.log('  [' + t.substring(0, 40) + '] ' + p.url().substring(0, 90));
  }
  return pages[0];
}

async function getPending(page) {
  return page.evaluate(() => {
    const cl = s => (s || '').replace(/\s+/g, ' ').trim();
    const rows = [...document.querySelectorAll('.el-table__body-wrapper > table > tbody > tr')]
      .filter(tr => !tr.closest('.el-dialog'))
      .map((tr, i) => ({ i, cells: [...tr.children].map(td => cl(td.innerText)), text: cl(tr.innerText) }))
      .filter(r => r.cells.length >= 6)
      .map(r => ({
        idx: r.i, course: r.cells[0] || '', type: r.cells[1] || '',
        need: Number((r.cells[4] || '').match(/\d+/)?.[0] || 0),
        result: r.cells[5] || ''
      }))
      .filter(r => r.need > 0 || r.result.includes('未评价'));
    return rows;
  });
}

async function dismissMsg(page) {
  for (let i = 0; i < 5; i++) {
    const b = page.locator('.el-message-box__wrapper:not([style*="display: none"]) button.el-button--primary');
    if (await b.count() === 0) return;
    await b.first().click();
    await sleep(400);
  }
}

async function waitTeachers(page, t = 15000) {
  const loc = page.locator('#hjjs_skjs .el-table__body-wrapper tbody tr');
  const start = Date.now();
  while (Date.now() - start < t) {
    const c = await loc.count();
    if (c > 0) return c;
    await sleep(400);
  }
  throw new Error('Teacher rows did not load');
}

async function waitForm(page, t = 10000) {
  const loc = page.locator('.el-dialog:visible');
  const start = Date.now();
  while (Date.now() - start < t) {
    for (let i = 0, n = await loc.count(); i < n; i++) {
      if ((await loc.nth(i).textContent()).includes('课程')) return i;
    }
    await sleep(300);
  }
  throw new Error('Form dialog did not appear');
}

async function fillRadios(page, idx) {
  const n = await page.locator('.el-radio').count();
  if (n < 65) throw new Error('Expected >=65 radios, got ' + n);
  const sets = [[1,6,11],[2,7,10],[0,5,9],[3,8,12]];
  const v = sets[idx % sets.length];
  for (let q = 0; q < 13; q++) {
    await page.locator('.el-radio').nth(q * 5 + (v.includes(q) ? 1 : 0)).click();
    await sleep(80);
  }
  console.log('   Radios done, varied: [' + v.map(x => x + 1).join() + ']');
}

async function fillComments(page, name, type, off) {
  const ta = page.locator('textarea');
  if (await ta.count() < 2) throw new Error('Need 2 textareas');
  const c = (name + ' ' + type).toLowerCase();
  let a, b;
  if (c.includes('体育') || c.includes('运动')) {
    a = '课程训练安排循序渐进，教师讲解动作要点清楚，能及时纠正练习中的问题，课堂氛围较好，对提升身体素质和运动习惯很有帮助。';
    b = '建议今后适当增加分层练习和动作反馈，让不同基础的同学都能更稳定地掌握技术要领。';
  } else if (c.includes('思政') || c.includes('思修') || c.includes('马克思') || c.includes('毛概') || c.includes('近代史') || c.includes('政治')) {
    a = name + '内容紧扣理论与现实问题，教师讲解脉络清楚，案例贴近实际，有助于加深对课程重点和社会现实的理解。';
    b = '建议今后适当增加课堂讨论和现实案例分析，帮助同学更主动地理解和运用相关理论。';
  } else if (c.includes('实验') || c.includes('实践') || c.includes('实训') || c.includes('操作') || c.includes('lab')) {
    a = name + '注重实践过程和操作规范，教师对步骤、方法和注意事项讲解清晰，能帮助理解课程内容并提升动手与分析能力。';
    b = '建议今后适当增加案例复盘和常见问题讲解，帮助同学更好地把握操作细节和结果分析方法。';
  } else {
    a = name + '课程内容安排较系统，教师讲解重点突出、条理清晰，能够结合实例帮助理解关键概念，对掌握课程知识和方法收获较大。';
    b = '建议今后适当增加典型案例、课堂练习和阶段性回顾，帮助同学更好地巩固重点内容。';
  }
  const s = ['', ' ', '  ', ' ', '.'][off % 5];
  await ta.nth(0).fill(a + s);
  await ta.nth(1).fill(b);
  console.log('   Comments done');
}

async function ask(page, label) {
  console.log('');
  console.log('Submit for: ' + label);
  console.log('  y = submit | skip = skip course | stop = exit');
  return new Promise(r => process.stdin.once('data', d => {
    const v = d.toString().trim().toLowerCase();
    r(v === 'skip' ? 'skip' : v === 'stop' ? 'stop' : 'ok');
  }));
}

async function doSubmit(page) {
  const b = page.locator('.el-dialog:visible button').filter({ hasText: '提交' });
  const n = await b.count();
  if (n === 0) {
    const b2 = page.locator('button').filter({ hasText: '提交' });
    if (await b2.count() === 0) throw new Error('Submit button not found');
    await b2.first().click();
  } else await b.first().click();
}

async function main() {
  console.log('Connecting CDP localhost:' + PORT + ' ...');
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:' + PORT);
  } catch (e) {
    console.error('Cannot connect. Start Edge/Chrome with --remote-debugging-port=' + PORT);
    process.exit(1);
  }
  try {
    const ctx = browser.contexts()[0];
    if (!ctx) throw new Error('No browser context');
    const page = await findEvalPage(ctx);
    if (!page) throw new Error('No evaluation page found');
    const title = await page.title().catch(() => '?');
    console.log('Using: ' + title.substring(0, 60));

    let courses = await getPending(page);
    console.log('Pending: ' + courses.length);
    if (courses.length === 0) { console.log('All evaluated!'); return; }
    courses.forEach(c => console.log('  [' + c.need + '] ' + c.course + ' - ' + c.result));
    if (DRY) { console.log('Dry run, exiting.'); return; }

    let tc = 0;
    for (let ci = 0; ci < courses.length; ci++) {
      const co = courses[ci];
      console.log('\n=== [' + (ci + 1) + '/' + courses.length + '] ' + co.course + ' ===');

      const sk = page.locator('a.skjs');
      if (await sk.count() === 0) { console.log('No teacher link'); continue; }
      await sk.nth(co.idx < await sk.count() ? co.idx : 0).click();
      console.log('Teacher dialog...');
      const trc = await waitTeachers(page);
      console.log('Teachers: ' + trc);

      let ts = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#hjjs_skjs .el-table__body-wrapper tbody tr')];
        return rows.map((tr, i) => {
          const c = [...tr.children].map(td => (td.textContent||'').replace(/\s+/g,' ').trim());
          return { i, id: c[0]||'', name: c[1]||'', op: c[2]||'' };
        }).filter(r => r.op.includes('评价'));
      });
      if (ts.length === 0) { console.log('All done, reload.'); await page.reload(); await sleep(2000); continue; }
      ts.forEach(t => console.log('  Teacher: ' + t.name));

      for (let ti = 0; ti < ts.length; ti++) {
        const t = ts[ti];
        console.log('\n  Teacher ' + (ti + 1) + '/' + ts.length + ': ' + t.name);

        const cur = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('#hjjs_skjs .el-table__body-wrapper tbody tr')];
          return rows.map((tr, i) => {
            const c = [...tr.children].map(td => (td.textContent||'').replace(/\s+/g,' ').trim());
            return { i, name: c[1]||'', op: c[2]||'' };
          }).filter(r => r.op.includes('评价'));
        });
        if (ti >= cur.length) continue;

        const el = page.locator('#hjjs_skjs .el-table__body-wrapper tbody tr a').filter({ hasText: '评价' });
        if (ti >= await el.count()) continue;
        await el.nth(ti).click();

        console.log('Form...');
        await waitForm(page);
        await fillRadios(page, tc + ti);
        await fillComments(page, co.course, co.type, tc + ti);

        if (NO_SUBMIT) { console.log('--no-submit, exit.'); return; }

        if (ti === 0) {
          const ans = await ask(page, co.course + ' / ' + t.name);
          if (ans === 'stop') return;
          if (ans === 'skip') {
            const cb = page.locator('.el-dialog:visible .el-dialog__headerbtn');
            if (await cb.count() > 0) { await cb.click(); await sleep(500); }
            break;
          }
        }

        await doSubmit(page);
        await sleep(1200);
        await dismissMsg(page);
        console.log('  DONE: ' + t.name);
        tc++;
      }

      console.log('Reload...');
      await page.reload();
      await sleep(2000);
    }

    console.log('\n=== VERIFY ===');
    const r = await getPending(page);
    if (r.length === 0) console.log('ALL EVALUATED!');
    else r.forEach(c => console.log('Pending: ' + c.course));
  } finally {
    if (browser) await browser.close();
    console.log('Done.');
  }
}

main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
