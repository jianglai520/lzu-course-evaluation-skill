#!/usr/bin/env node
/**
 * LZU Course Evaluation Automation Script (Uni-app Edition)
 *
 * Connects to running Edge/Chrome via Chrome DevTools Protocol (CDP).
 * No browser extension needed. Handles the uni-app version of the LZU
 * evaluation system (not the older Element UI version).
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
const AUTO_YES = process.argv.includes('--yes');

let chromium;
try { chromium = require('playwright').chromium; }
catch {
  console.error('Playwright not found. Run: npm install playwright');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function findEvalPage(ctx) {
  const pages = ctx.pages();
  let portalPage = pages.find(p => p.url().includes('service-iframe'));
  if (!portalPage) portalPage = pages.find(p => p.url().includes('jwqe'));
  if (!portalPage) portalPage = pages.find(p => p.url().includes('my.lzu.edu.cn'));
  if (portalPage) {
    const frames = portalPage.frames();
    const evalFrame = frames.find(f => f.name() === 'service-iframe');
    if (evalFrame) {
      console.log('Found evaluation inside iframe: ' + evalFrame.url().substring(0, 100));
      return { page: portalPage, frame: evalFrame };
    }
    return { page: portalPage, frame: portalPage };
  }
  console.log('Available pages:');
  for (const p of pages) {
    const t = await p.title().catch(() => '?');
    console.log('  [' + t.substring(0, 40) + '] ' + p.url().substring(0, 90));
  }
  const fb = pages[0];
  return { page: fb, frame: fb };
}

/**
 * Get pending courses from the course list page.
 * Works with the uni-app version using box-hjjs classes.
 */
async function getPending(dom) {
  return await dom.evaluate(() => {
    const cl = s => (s || '').replace(/\s+/g, ' ').trim();
    const names = [...document.querySelectorAll('.box-hjjs-middle-1')].map(el => cl(el.textContent));
    const needs = [...document.querySelectorAll('.box-hjjs-middle-xpj')].map(el => {
      const t = cl(el.textContent);
      const m = t.match(/\d+/);
      return m ? parseInt(m[0]) : 0;
    });
    return names.map((name, i) => ({
      course: name,
      need: needs[i] || 0,
      idx: i
    })).filter(c => c.need > 0);
  });
}

/**
 * Navigate to the course list if we're on the evaluation form page.
 */
async function ensureCourseList(dom) {
  const url = await dom.evaluate(() => location.href);
  if (url.includes('evalute') || url.includes('pj?')) {
    const isForm = await dom.evaluate(() => !!document.querySelector('.box3-1-2-2'));
    if (isForm) {
      console.log('Currently on evaluation form, navigating back to course list...');
      await dom.evaluate(() => { location.href = '/#/pages/student/evalutationTeach/pj?taskid=94'; });
      await sleep(3000);
    }
  }
}

/**
 * Navigate back to the course list page.
 */
async function goToCourseList(dom) {
  await dom.evaluate(() => { location.href = '/#/pages/student/evalutationTeach/pj?taskid=94'; });
  await sleep(3000);
}

/**
 * Fill the evaluation form: 13 radio questions + 2 text comments.
 * Uni-app version uses .box3-1-2-2 > uni-list-cell with option text.
 */
async function fillForm(dom, courseName, teacherOffset) {
  // Step 1: fill radio questions directly by clicking .uni-list-cell
  const containerCount = await dom.evaluate(() => document.querySelectorAll('.box3-1-2-2').length);
  const radioCount = Math.min(containerCount, 13);
  console.log('   Radio containers: ' + containerCount);

  // Varied question sets (0-based)
  const variedSets = [
    [1, 6, 11], [2, 7, 10], [0, 5, 9], [3, 8, 12]
  ];
  const varied = variedSets[teacherOffset % variedSets.length];

  for (let q = 0; q < radioCount; q++) {
    const optIdx = (q === 0) ? 0 : (varied.includes(q) ? 1 : 0);
    await dom.evaluate(({ qIdx, oIdx }) => {
      const containers = document.querySelectorAll('.box3-1-2-2');
      const container = containers[qIdx];
      if (!container) return;
      const items = container.querySelectorAll('.uni-list-cell');
      if (items[oIdx]) items[oIdx].click();
    }, { qIdx: q, oIdx: optIdx });
    await sleep(80);
  }
  console.log('   Filled ' + radioCount + ' radio questions (varied: [' + varied.map(v => v+1).join(',') + '])');

  // Step 2: fill text comments
  const commentType = courseName.toLowerCase().includes('体育') ? 'sports'
    : (courseName.includes('思政') || courseName.includes('思修') || courseName.includes('马克思') || courseName.includes('毛概') || courseName.includes('近代史') || courseName.includes('政治')) ? 'ideology'
    : (courseName.includes('实验') || courseName.includes('实践') || courseName.includes('实训')) ? 'practicum'
    : 'theory';

  let c1, c2;
  if (commentType === 'sports') {
    c1 = '课程训练安排循序渐进，教师讲解动作要点清楚，能及时纠正练习中的问题，课堂氛围较好，对提升身体素质和运动习惯很有帮助。';
    c2 = '建议今后适当增加分层练习和动作反馈，让不同基础的同学都能更稳定地掌握技术要领。';
  } else if (commentType === 'ideology') {
    c1 = courseName + '内容紧扣理论与现实问题，教师讲解脉络清楚，案例贴近实际，有助于加深对课程重点和社会现实的理解。';
    c2 = '建议今后适当增加课堂讨论和现实案例分析，帮助同学更主动地理解和运用相关理论。';
  } else if (commentType === 'practicum') {
    c1 = courseName + '注重实践过程和操作规范，教师对步骤、方法和注意事项讲解清晰，能帮助理解课程内容并提升动手与分析能力。';
    c2 = '建议今后适当增加案例复盘和常见问题讲解，帮助同学更好地把握操作细节和结果分析方法。';
  } else {
    c1 = courseName + '课程内容安排较系统，教师讲解重点突出、条理清晰，能够结合实例帮助理解关键概念，对掌握课程知识和方法收获较大。';
    c2 = '建议今后适当增加典型案例、课堂练习和阶段性回顾，帮助同学更好地巩固重点内容。';
  }

  // Fill textareas
  const taCount = await dom.evaluate(() => {
    const tas = document.querySelectorAll('.uni-textarea-textarea, textarea');
    return tas.length;
  });

  if (taCount >= 2) {
    await dom.evaluate(({ t1, t2 }) => {
      const tas = document.querySelectorAll('.uni-textarea-textarea, textarea');
      if (tas[0]) {
        tas[0].value = t1;
        tas[0].dispatchEvent(new Event('input', { bubbles: true }));
        tas[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (tas[1]) {
        tas[1].value = t2;
        tas[1].dispatchEvent(new Event('input', { bubbles: true }));
        tas[1].dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, { t1: c1, t2: c2 });
    console.log('   Filled 2 text comments (' + commentType + ' style)');
  } else {
    console.log('   ⚠ Only ' + taCount + ' textareas found');
  }

  await sleep(500);
}

/**
 * Submit the evaluation form.
 * Uni-app version: click .box3-1 containing "提交"
 */
async function submitForm(dom) {
  // Click submit button
  const clicked = await dom.evaluate(() => {
    const btn = document.querySelector('.box3-1');
    if (!btn) return 'no button found';
    btn.click();
    return 'clicked';
  });
  console.log('   Submit: ' + clicked);
  await sleep(2000);

  // Handle confirmation dialog (uni-modal with OK/Cancel)
  const confirmed = await dom.evaluate(() => {
    const okBtn = document.querySelector('.uni-modal__btn_primary');
    if (okBtn) { okBtn.click(); return 'confirmed'; }
    return 'no confirmation dialog';
  });
  if (confirmed === 'confirmed') {
    console.log('   Confirmed submission');
    await sleep(2000);
  }
}

/**
 * Dismiss any open popup/overlay.
 */
async function dismissPopup(dom) {
  await dom.evaluate(() => {
    const mask = document.querySelector('.uni-mask, .pop_modal');
    if (mask) mask.click();
  });
  await sleep(1000);
}

/**
 * Handle teacher selection popup: click the first "评价" button inside it.
 * Returns true if a teacher was selected.
 */
async function handleTeacherPopup(dom) {
  const found = await dom.evaluate(() => {
    const popup = document.querySelector('.pop_modal');
    if (!popup) return false;
    // Search for clickable element with text "评价"
    const all = popup.querySelectorAll('*');
    for (const el of all) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t === '评价') { el.click(); return true; }
    }
    return false;
  });
  return found;
}

/**
 * Ask user for confirmation before submitting.
 */
async function askUser(label) {
  console.log('');
  console.log('Submit evaluation for: ' + label);
  console.log('  y = submit | skip = skip course | stop = exit');
  return new Promise(r => process.stdin.once('data', d => {
    const v = d.toString().trim().toLowerCase();
    r(v === 'skip' ? 'skip' : v === 'stop' ? 'stop' : 'ok');
  }));
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
    const { page, frame } = await findEvalPage(ctx);
    if (!page) throw new Error('No evaluation page found');
    const dom = frame || page;
    const title = await page.title().catch(() => '?');
    console.log('Using: ' + title.substring(0, 60));

    // Ensure we're on the course list page
    await ensureCourseList(dom);

    // Get pending courses
    let courses = await getPending(dom);
    console.log('Pending courses: ' + courses.length);
    if (courses.length === 0) { console.log('All evaluated!'); return; }
    for (const c of courses) {
      console.log('  [' + c.need + '] ' + c.course);
    }
    if (DRY) { console.log('Dry run, exiting.'); return; }

    let tCount = 0;
    while (true) {
      // Get fresh course list
      courses = await getPending(dom);
      if (courses.length === 0) { console.log('No more pending courses.'); break; }

      const course = courses[0];
      console.log('\n=== [' + course.course + '] (remaining: ' + courses.length + ') ===');

      // Dismiss any lingering popup
      await dismissPopup(dom);
      await sleep(1000);

      // Click "教师评价" via JavaScript
      const clicked = await dom.evaluate(() => {
        const btns = document.querySelectorAll('.box-hjjs-footer-jspj');
        if (btns[0]) { btns[0].click(); return true; }
        return false;
      });
      if (!clicked) { console.log('   Could not click teacher evaluation button'); break; }
      console.log('   Clicked 教师评价');
      await sleep(4000);

      // Handle teacher selection popup (for courses with 2+ teachers)
      const hasPopup = await dom.evaluate(() => {
        const popup = document.querySelector('.pop_modal');
        if (!popup) return false;
        const text = popup.textContent || '';
        return text.includes('教师选择');
      });
      if (hasPopup) {
        console.log('   Teacher selection popup, selecting teacher...');
        const selected = await dom.evaluate(() => {
          const popup = document.querySelector('.pop_modal');
          if (!popup) return false;
          // Find all elements with text "评价" inside popup
          const all = popup.querySelectorAll('*');
          for (const el of all) {
            const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (t === '评价') { el.click(); return true; }
          }
          return false;
        });
        console.log('   Teacher ' + (selected ? 'selected' : 'selection failed'));
        await sleep(4000);
      }

      // Wait for form to load
      let onForm = false;
      for (let attempt = 0; attempt < 15; attempt++) {
        onForm = await dom.evaluate(() => !!document.querySelector('.box3-1-2-2'));
        if (onForm) break;
        await sleep(1000);
      }
      if (!onForm) { console.log('   Form not loaded, skipping'); continue; }
      console.log('   Form loaded!');

      // Fill the form
      await fillForm(dom, course.course, tCount);

      if (NO_SUBMIT) { console.log('--no-submit mode, exiting.'); return; }

      // Ask for confirmation before first course (unless --yes)
      if (!AUTO_YES && tCount === 0) {
        const ans = await askUser(course.course);
        if (ans === 'stop') return;
        if (ans === 'skip') { await goToCourseList(dom); continue; }
      } else if (AUTO_YES && tCount === 0) {
        console.log('   --yes mode, auto-submitting...');
      }

      // Submit
      await submitForm(dom);
      console.log('   ✅ ' + course.course + ' evaluated!');
      tCount++;

      // Navigate back to course list
      await sleep(2000);
      await goToCourseList(dom);
    }

    console.log('\n=== VERIFY ===');
    const remaining = await getPending(dom);
    if (remaining.length === 0) console.log('ALL EVALUATED! 🎉');
    else remaining.forEach(c => console.log('Pending: ' + c.course));

  } finally {
    if (browser) await browser.close();
    console.log('Done.');
  }
}

main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
