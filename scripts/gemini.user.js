// ==UserScript==
// @name         Gemini → Markdown 下載
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  下載 Gemini 對話為 Markdown（下載 / 複製），支援 [gemini][date]title 檔名格式
// @author       Gemini User
// @match        https://gemini.google.com/*
// @updateURL https://github.com/DabitApp/tampermonkey-script/blob/main/scripts/gemini.user.js
// @downloadURL https://github.com/DabitApp/tampermonkey-script/blob/main/scripts/gemini.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const PANEL_ID = 'gemini-dump-tool';

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

    function flashButton(btn, text) {
        const original = btn.dataset.label || btn.textContent;
        btn.dataset.label = original;
        btn.textContent = text;
        setTimeout(() => { btn.textContent = original; }, 2000);
    }

    function buildMarkdown() {
        const mode = document.getElementById('export-type').value;
        const chatTitle = document.title.replace(' - Gemini', '').trim() || 'Untitled';
        const now = new Date();
        const dateStr = now.getFullYear()
            + String(now.getMonth() + 1).padStart(2, '0')
            + String(now.getDate()).padStart(2, '0');
        const dateTimeFull = now.toLocaleString();

        let markdown = `---\ntitle: ${chatTitle}\ndate: ${dateTimeFull}\n---\n\n# ${chatTitle}\n\n`;

        const entries = document.querySelectorAll('.query-text-line, message-content');
        if (entries.length === 0) return null;

        entries.forEach((el) => {
            const isUser = el.classList.contains('query-text-line');
            const text = el.innerText.trim();
            if (mode === 'all') {
                markdown += isUser ? `## 🙋 User\n${text}\n\n` : `## 🤖 Gemini\n${text}\n\n---\n\n`;
            } else if (mode === 'q' && isUser) {
                markdown += `> ${text}\n\n`;
            } else if (mode === 'a' && !isUser) {
                markdown += `${text}\n\n---\n\n`;
            }
        });

        const safeTitle = chatTitle.replace(/[\\/:*?"<>|]/g, '_');
        return {
            content: markdown,
            fileName: `[gemini][${dateStr}]${safeTitle}.md`,
        };
    }

    function handleDownload(btn) {
        const data = buildMarkdown();
        if (!data) { alert('找不到對話內容，請確認網頁已完全載入。'); return; }
        const blob = new Blob([data.content], { type: 'text/markdown;charset=utf-8' });
        const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(blob),
            download: data.fileName,
        });
        a.click();
        URL.revokeObjectURL(a.href);
        flashButton(btn, '✓ 已下載');
    }

    function handleCopy(btn) {
        const data = buildMarkdown();
        if (!data) { alert('找不到對話內容，請確認網頁已完全載入。'); return; }
        navigator.clipboard.writeText(data.content).then(() => flashButton(btn, '✓ 已複製'));
    }

    function createUI() {
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
        if (!document.getElementById(PANEL_ID)) createUI();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    createUI();
})();
