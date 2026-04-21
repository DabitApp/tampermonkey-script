// ==UserScript==
// @name         Gemini 完整對話工具 (匯出/複製) - V3
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  支援 [gemini][date]subject 檔名格式，移除 source，新增複製功能
// @author       Gemini User
// @match        https://gemini.google.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function createUI() {
        if (document.getElementById('gemini-dump-tool')) return;

        const container = document.createElement('div');
        container.id = 'gemini-dump-tool';
        container.style.cssText = `
            position: fixed; bottom: 80px; right: 20px; z-index: 9999;
            background: #2e2f32; border: 1px solid #5f6368; padding: 12px;
            border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.4);
            display: flex; flex-direction: column; gap: 8px; font-family: sans-serif;
        `;

        const select = document.createElement('select');
        select.id = 'export-type';
        select.style.cssText = "background: #1e1f20; color: white; border: 1px solid #5f6368; padding: 6px; border-radius: 6px; cursor: pointer; font-size: 13px;";

        const options = [
            { value: 'all', text: '完整對話 (Q&A)' },
            { value: 'q', text: '僅提問 (User)' },
            { value: 'a', text: '僅回答 (Gemini)' }
        ];

        options.forEach(optData => {
            const opt = document.createElement('option');
            opt.value = optData.value;
            opt.textContent = optData.text;
            select.appendChild(opt);
        });

        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '8px';

        const btnExport = createButton('匯出', '#c2e7ff', '#001d35', () => handleAction('download'));
        const btnCopy = createButton('複製', '#e3e3e3', '#1f1f1f', () => handleAction('copy'));

        btnGroup.appendChild(btnExport);
        btnGroup.appendChild(btnCopy);
        container.appendChild(select);
        container.appendChild(btnGroup);
        document.body.appendChild(container);
    }

    function createButton(text, bg, color, onClick) {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.cssText = `background: ${bg}; color: ${color}; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; flex: 1; font-size: 13px;`;
        btn.onclick = onClick;
        return btn;
    }

    function getMarkdownData() {
        const mode = document.getElementById('export-type').value;
        const chatTitle = document.title.replace(" - Gemini", "").trim() || "Untitled";
        const now = new Date();
        const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
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

        return {
            content: markdown,
            fileName: `[gemini][${dateStr}]${chatTitle.replace(/[\\/:*?"<>|]/g, "_")}.md`
        };
    }

    function handleAction(type) {
        const data = getMarkdownData();
        if (!data) {
            alert("找不到對話內容，請確認網頁已完全載入。");
            return;
        }

        if (type === 'download') {
            const blob = new Blob([data.content], { type: 'text/markdown' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = data.fileName;
            a.click();
            URL.revokeObjectURL(a.href);
        } else if (type === 'copy') {
            navigator.clipboard.writeText(data.content).then(() => {
                const originalText = event.target.innerText;
                event.target.innerText = '已複製！';
                setTimeout(() => event.target.innerText = originalText, 2000);
            });
        }
    }

    const observer = new MutationObserver(() => {
        if (!document.getElementById('gemini-dump-tool')) createUI();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    createUI();
})();