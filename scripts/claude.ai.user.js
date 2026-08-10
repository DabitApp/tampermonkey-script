// ==UserScript==
// @name         Claude.ai → Markdown 下載
// @namespace    https://claude.ai/
// @version      2.2
// @description  下載 Claude.ai 對話為 Markdown（下載 / 複製，支援虛擬捲動對話自動收集全部訊息）
// @match        https://claude.ai/*
// @updateURL https://github.com/DabitApp/tampermonkey-script/blob/main/scripts/claude.ai.user.js
// @downloadURL https://github.com/DabitApp/tampermonkey-script/blob/main/scripts/claude.ai.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID = 'md-export-panel';

  function htmlToMd(el) {
    function walk(node) {
      if (node.nodeType === 3) return node.textContent;
      const tag = node.tagName?.toLowerCase();
      const ch = () => [...node.childNodes].map(walk).join('');

      if (tag === 'p')   return '\n\n' + ch() + '\n\n';
      if (tag === 'br')  return '\n';
      if (tag === 'strong' || tag === 'b') return '**' + ch() + '**';
      if (tag === 'em'   || tag === 'i')   return '_' + ch() + '_';
      if (tag === 'code' && node.parentElement?.tagName?.toLowerCase() !== 'pre')
                         return '`' + ch() + '`';
      if (tag === 'pre') {
        const lang = node.querySelector('code')?.className?.match(/language-(\w+)/)?.[1] || '';
        const code = node.querySelector('code')?.innerText ?? node.innerText;
        return '\n\n```' + lang + '\n' + code + '\n```\n\n';
      }
      if (/^h([1-6])$/.test(tag))
        return '\n\n' + '#'.repeat(+tag[1]) + ' ' + ch() + '\n\n';
      if (tag === 'ul')
        return '\n' + [...node.children].map(li => '- ' + walk(li).trim()).join('\n') + '\n';
      if (tag === 'ol')
        return '\n' + [...node.children].map((li, i) => (i+1) + '. ' + walk(li).trim()).join('\n') + '\n';
      if (tag === 'li')        return ch();
      if (tag === 'a')         return '[' + ch() + '](' + node.href + ')';
      if (tag === 'blockquote')
        return ch().split('\n').map(l => '> ' + l).join('\n');
      if (tag === 'table') {
        const rows = [...node.querySelectorAll('tr')];
        return '\n' + rows.map((r, i) => {
          const cells = [...r.querySelectorAll('th,td')].map(c => walk(c).trim()).join(' | ');
          return '| ' + cells + ' |' + (i === 0 ? '\n|' + cells.split('|').map(() => '---').join('|') + '|' : '');
        }).join('\n') + '\n';
      }
      return ch();
    }
    return walk(el).replace(/\n{3,}/g, '\n\n').trim();
  }

  function getTitle() {
    return document.title?.replace(/ [-–] Claude$/, '').trim() || 'claude-export';
  }

  function getAiContent(turn) {
    const sections = [...turn.querySelectorAll('.standard-markdown, .progressive-markdown')];
    if (!sections.length) return null;
    const wrapper = document.createElement('div');
    sections.forEach(s => wrapper.appendChild(s.cloneNode(true)));
    return wrapper;
  }

  function getUserContent(turn) {
    return turn.querySelector('[data-testid="user-message"]') || turn;
  }

  function getTurnKind(turn) {
    if (turn.querySelector('[data-testid="user-message"]')) return 'user';
    if (turn.querySelector('.font-claude-response')) return 'assistant';
    return null;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function findScrollContainer() {
    return document.querySelector('[data-autoscroll-container="true"]');
  }

  // Claude.ai 的對話列表採用虛擬捲動，畫面外的訊息會被卸載（僅留下 spacer）。
  // 需要實際捲動整個對話，逐步收集每個 aria-posinset 對應的訊息節點，
  // 才能確保長對話不會漏掉中間被卸載的訊息。
  async function collectAllTurns(onProgress) {
    const collected = new Map();

    const scanOnce = () => {
      document.querySelectorAll('[role="article"][aria-posinset]').forEach(turn => {
        const pos = turn.getAttribute('aria-posinset');
        if (!pos || collected.has(pos)) return;
        const kind = getTurnKind(turn);
        if (!kind) return;
        collected.set(pos, { pos: +pos, kind, turn: turn.cloneNode(true) });
      });
    };

    const container = findScrollContainer();
    scanOnce();

    if (container) {
      const originalTop = container.scrollTop;
      container.scrollTop = 0;
      await sleep(200);
      scanOnce();

      let stable = 0;
      let lastHeight = -1;
      let guard = 0;
      while (stable < 2 && guard < 500) {
        guard++;
        const step = Math.max(container.clientHeight * 0.8, 200);
        container.scrollTop = Math.min(container.scrollTop + step, container.scrollHeight);
        await sleep(220);
        scanOnce();
        onProgress?.(collected.size);

        const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
        if (atBottom && container.scrollHeight === lastHeight) stable++;
        else stable = 0;
        lastHeight = container.scrollHeight;
      }

      container.scrollTop = originalTop;
      await sleep(50);
    }

    return [...collected.values()].sort((a, b) => a.pos - b.pos);
  }

  async function buildMarkdown(onProgress) {
    const mode = document.getElementById('export-type').value;
    const turns = await collectAllTurns(onProgress);

    if (!turns.length) return null;

    const title = getTitle();
    let md = '# ' + title + '\n\n';
    md += '_下載時間：' + new Date().toLocaleString('zh-TW') + '_\n\n---\n\n';

    turns.forEach(({ kind, turn }) => {
      const isUser = kind === 'user';
      const contentEl = isUser ? getUserContent(turn) : getAiContent(turn);
      if (!contentEl) return;
      const text = htmlToMd(contentEl).trim();
      if (!text) return;
      if (mode === 'all') {
        md += (isUser ? '## 🙋 User\n' : '## 🤖 Claude\n') + text + '\n\n---\n\n';
      } else if (mode === 'q' && isUser) {
        md += `> ${text}\n\n`;
      } else if (mode === 'a' && !isUser) {
        md += `${text}\n\n---\n\n`;
      }
    });

    const now = new Date();
    const dateStr = now.getFullYear()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0');
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `[claude][${dateStr}]${safeTitle}.md`;

    return { content: md, fileName };
  }

  function flashButton(btn, text) {
    const original = btn.dataset.label || btn.textContent;
    btn.dataset.label = original;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = original; }, 2000);
  }

  async function runExport(btn, onDone) {
    if (btn.disabled) return;
    btn.disabled = true;
    const original = btn.dataset.label || btn.textContent;
    btn.dataset.label = original;
    try {
      const data = await buildMarkdown(count => { btn.textContent = `掃描中… (${count})`; });
      if (!data) { btn.textContent = original; alert('找不到對話，請確認頁面載入完成。'); return; }
      await onDone(data); // onDone 會透過 flashButton 顯示完成訊息並自行還原文字
    } catch (err) {
      btn.textContent = original;
      console.error('[md-export]', err);
    } finally {
      btn.disabled = false;
    }
  }

  function handleDownload(btn) {
    runExport(btn, async data => {
      const blob = new Blob([data.content], { type: 'text/markdown;charset=utf-8' });
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: data.fileName,
      });
      a.click();
      URL.revokeObjectURL(a.href);
      flashButton(btn, '✓ 已下載');
    });
  }

  function handleCopy(btn) {
    runExport(btn, async data => {
      await navigator.clipboard.writeText(data.content);
      flashButton(btn, '✓ 已複製');
    });
  }

  function createButton(text, primary, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      background: ${primary ? '#c2e7ff' : '#e3e3e3'};
      color: ${primary ? '#001d35' : '#1f1f1f'};
      border: none; padding: 8px 16px; border-radius: 8px;
      cursor: pointer; font-weight: bold; flex: 1; font-size: 13px;
    `;
    btn.addEventListener('click', () => onClick(btn));
    return btn;
  }

  function injectPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const container = document.createElement('div');
    container.id = PANEL_ID;
    container.style.cssText = `
      position: fixed; bottom: 80px; right: 20px; z-index: 9999;
      background: #2e2f32; border: 1px solid #5f6368; padding: 12px;
      border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.4);
      display: flex; flex-direction: column; gap: 8px; font-family: sans-serif;
    `;

    const select = document.createElement('select');
    select.id = 'export-type';
    select.style.cssText = 'background: #1e1f20; color: white; border: 1px solid #5f6368; padding: 6px; border-radius: 6px; cursor: pointer; font-size: 13px;';

    [
      { value: 'all', text: '完整對話 (Q&A)' },
      { value: 'q',   text: '僅提問 (User)' },
      { value: 'a',   text: '僅回答 (AI)' },
    ].forEach(optData => {
      const opt = document.createElement('option');
      opt.value = optData.value;
      opt.textContent = optData.text;
      select.appendChild(opt);
    });

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display: flex; gap: 8px;';
    btnGroup.appendChild(createButton('下載', true, handleDownload));
    btnGroup.appendChild(createButton('複製', false, handleCopy));

    container.appendChild(select);
    container.appendChild(btnGroup);
    document.body.appendChild(container);
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById(PANEL_ID)) injectPanel();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', injectPanel);
})();
