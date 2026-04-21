// ==UserScript==
// @name         Claude.ai → Markdown Export v2
// @namespace    https://claude.ai/
// @version      2.0
// @description  匯出對話為 Markdown（下載 + 複製）
// @match        https://claude.ai/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

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

  // ★ 核心修正：精確定位 AI 的 prose 內容，排除按鈕
    function getContentEl(turn, isUser) {
        if (isUser) {
            return turn.querySelector('.whitespace-pre-wrap') || turn;
        } else {
            return (
                turn.querySelector('.standard-markdown')    ||
                turn.querySelector('.progressive-markdown') ||
                turn
            );
        }
    }
function getAiContent(turn) {
  const sections = [...turn.querySelectorAll('.standard-markdown, .progressive-markdown')];
  if (!sections.length) return turn;

  // 建一個臨時容器把所有 section 合併，保持順序
  const wrapper = document.createElement('div');
  sections.forEach(s => {
    const clone = s.cloneNode(true);
    wrapper.appendChild(clone);
  });
  return wrapper;
}

function buildMarkdown() {
  const allTurns = [...document.querySelectorAll(
    '[data-testid="user-message"], .font-claude-response'
  )];

  // 過濾掉 sidebar 的 .font-claude-response（沒有 .standard-markdown 子元素）
  const turns = allTurns.filter(el =>
    el.dataset.testid === 'user-message' ||
    el.querySelector('.standard-markdown, .progressive-markdown')
  );

  if (!turns.length) { alert('找不到對話，請確認頁面載入完成。'); return ''; }

  let md = '# ' + getTitle() + '\n\n';
  md += '_匯出時間：' + new Date().toLocaleString('zh-TW') + '_\n\n---\n\n';

  turns.forEach(turn => {
    const isUser = turn.dataset.testid === 'user-message';
    const role = isUser ? '**You**' : '**Claude**';
    const contentEl = isUser
    ? (turn.querySelector('.whitespace-pre-wrap') || turn)
    : getAiContent(turn);
    const text = htmlToMd(contentEl).trim();
    if (text) md += role + '\n\n' + text + '\n\n---\n\n';
  });

  return md;
}

  function downloadMarkdown() {
    const md = buildMarkdown();
    if (!md.includes('---')) { alert('找不到對話，請確認頁面載入完成。'); return; }
    const slug = getTitle().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g,'').slice(0,60);
    const filename = slug + '-' + new Date().toISOString().slice(0,10) + '.md';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
    a.click();
  }

  // ★ 新增：複製到剪貼簿
  function copyMarkdown() {
    const md = buildMarkdown();
    navigator.clipboard.writeText(md).then(() => {
      copyBtn.textContent = '✓ 已複製';
      setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
    });
  }

  let copyBtn;

  function injectButtons() {
    if (document.getElementById('md-export-btn')) return;

    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position: 'fixed', bottom: '80px', right: '20px', zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: '8px',
    });

    const style = {
      padding: '8px 12px', borderRadius: '8px',
      border: '1px solid rgba(128,128,128,.4)',
      background: 'rgba(30,30,30,.85)', color: '#fff',
      fontSize: '13px', fontWeight: '500', cursor: 'pointer',
      backdropFilter: 'blur(6px)', boxShadow: '0 2px 8px rgba(0,0,0,.3)',
    };

    const dlBtn = document.createElement('button');
    dlBtn.id = 'md-export-btn';
    dlBtn.textContent = '⬇ MD';
    Object.assign(dlBtn.style, style);
    dlBtn.addEventListener('click', downloadMarkdown);

    copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copy';
    Object.assign(copyBtn.style, style);
    copyBtn.addEventListener('click', copyMarkdown);

    wrap.appendChild(copyBtn);
    wrap.appendChild(dlBtn);
    document.body.appendChild(wrap);
  }

  const observer = new MutationObserver(injectButtons);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', injectButtons);
})();
