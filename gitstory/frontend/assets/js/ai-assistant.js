/**
 * ai-assistant.js — GitStory AI: Qwen-Powered Repository Assistant
 *
 * Provides a context-aware interactive AI assistant chat interface,
 * rendering in both the dashboard grid and an omnipresent floating drawer.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GitStoryAIAssistant = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Safe Markdown Parser ───────────────────────────────────────────────────

  function safeEscapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Lightweight, robust Markdown to HTML renderer.
   * Handles code fences with copy buttons, inline code, bold, italic,
   * headers, lists, and links.
   *
   * @param {string} md
   * @returns {string} Safe HTML
   */
  function renderMarkdownToHtml(md) {
    if (!md) return '';

    // First escape HTML entities
    let text = safeEscapeHtml(md);

    // 1. Code blocks (```lang ... ```)
    const codeBlocks = [];
    text = text.replace(/```([a-zA-Z0-9_\-\.]*)[ \t]*\r?\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = `code_block_${codeBlocks.length}`;
      const langLabel = lang ? `<span class="ai-code-lang">${lang}</span>` : '';
      const html = `
        <div class="ai-code-wrapper">
          <div class="ai-code-header">
            ${langLabel}
            <button class="ai-copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.innerText);this.innerText='Copied!';setTimeout(()=>this.innerText='Copy',1800);">Copy</button>
          </div>
          <pre class="ai-code-block"><code>${code.trim()}</code></pre>
        </div>
      `;
      codeBlocks.push(html);
      return `%%%CODEBLOCK${codeBlocks.length - 1}%%%`;
    });

    // 2. Inline code (`...`)
    text = text.replace(/`([^`\n]+)`/g, '<code class="ai-inline-code">$1</code>');

    // 3. Headers (###, ##, #)
    text = text.replace(/^### (.*$)/gim, '<h4 class="ai-h4">$1</h4>');
    text = text.replace(/^## (.*$)/gim, '<h3 class="ai-h3">$1</h3>');
    text = text.replace(/^# (.*$)/gim, '<h2 class="ai-h2">$1</h2>');

    // 4. Bold and Italic
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
    text = text.replace(/\*([^\*\n]+)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_\n]+)_/g, '<em>$1</em>');

    // 5. Horizontal rules
    text = text.replace(/^---$/gim, '<hr class="ai-hr"/>');

    // 6. Links [text](url)
    text = text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-link">$1 ↗</a>'
    );

    // 7. Bullet lists
    const lines = text.split('\n');
    const resultLines = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const listMatch = line.match(/^\s*[-*]\s+(.*)$/);

      if (listMatch) {
        if (!inList) {
          resultLines.push('<ul class="ai-list">');
          inList = true;
        }
        resultLines.push(`<li>${listMatch[1]}</li>`);
      } else {
        if (inList) {
          resultLines.push('</ul>');
          inList = false;
        }
        if (line.trim().length > 0) {
          // Wrap normal lines in paragraph if not already an HTML tag or placeholder
          if (!line.startsWith('<h') && !line.startsWith('%%%CODEBLOCK') && !line.startsWith('<hr')) {
            resultLines.push(`<p class="ai-p">${line}</p>`);
          } else {
            resultLines.push(line);
          }
        }
      }
    }
    if (inList) {
      resultLines.push('</ul>');
    }

    text = resultLines.join('\n');

    // Restore code blocks
    codeBlocks.forEach((block, idx) => {
      text = text.replace(`%%%CODEBLOCK${idx}%%%`, block);
    });

    return text;
  }

  // ── Default Prompt Chips ───────────────────────────────────────────────────

  const DEFAULT_SUGGESTIONS = [
    { label: '🌟 What is this repo about?', prompt: 'What is the core purpose and high-level overview of this repository?' },
    { label: '🏗️ Explain Architecture', prompt: 'Explain the architecture and main structural components of this codebase.' },
    { label: '👥 Top Contributors', prompt: 'Who are the primary contributors and what are their contributions?' },
    { label: '🔥 Frequently Changed Files', prompt: 'Which files change most frequently and why are they critical?' },
    { label: '🚀 How to get started?', prompt: 'How would a developer get started exploring or running this project?' },
  ];

  // ── AIAssistant UI Component ───────────────────────────────────────────────

  class AIAssistantComponent {
    /**
     * @param {HTMLElement|string} container - Mount point in dashboard
     * @param {Object} options
     * @param {string} options.owner
     * @param {string} options.repo
     * @param {Object} [options.repoData]
     */
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      this.owner = options.owner || '';
      this.repo = options.repo || '';
      this.repoData = options.repoData || {};

      this.messages = [];
      this.isThinking = false;
      this.isDrawerOpen = false;

      // Seed initial greeting
      const repoName = this.repoData.full_name || (this.owner ? `${this.owner}/${this.repo}` : 'this repository');
      this.messages.push({
        role: 'assistant',
        content: `Hello! I'm **GitStory AI**, your intelligent repository copilot powered by **Qwen 2.5 Coder**.\n\nI have live context on **${repoName}**. Ask me about the code architecture, commit trends, contributor impact, hot files, or how to get started!`,
      });

      if (this.container) {
        this.renderCard();
      }
      this.initFloatingDrawer();
    }

    // ── In-Page Dashboard Card Render ────────────────────────────────────────

    renderCard() {
      if (!this.container) return;

      this.container.innerHTML = `
        <div class="card-header" style="flex-wrap:wrap;gap:12px;">
          <div>
            <h2 class="card-title" style="display:flex;align-items:center;gap:8px;">
              <span aria-hidden="true">🤖</span> GitStory AI Assistant
            </h2>
            <span style="font-size:0.75rem;color:var(--color-text-muted);">
              Context-aware repository copilot powered by <strong>Qwen 2.5 Coder</strong>
            </span>
          </div>

          <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
            <span class="ai-status-pill"><span class="ai-status-dot"></span> Qwen Online</span>
            <button class="btn btn-ghost btn-sm" id="ai-card-clear" title="Clear chat history">Clear</button>
          </div>
        </div>

        <div class="ai-chat-body">
          <!-- Suggestion Chips -->
          <div class="ai-chips-row" id="ai-card-chips" role="group" aria-label="Quick questions">
            ${DEFAULT_SUGGESTIONS.map(s => `
              <button class="ai-chip-btn" data-prompt="${safeEscapeHtml(s.prompt)}">${s.label}</button>
            `).join('')}
          </div>

          <!-- Messages Container -->
          <div class="ai-messages-container" id="ai-card-messages" role="log" aria-live="polite">
            ${this.renderMessagesHtml()}
          </div>

          <!-- Chat Input Bar -->
          <form class="ai-input-form" id="ai-card-form">
            <textarea
              class="ai-textarea"
              id="ai-card-input"
              rows="1"
              placeholder="Ask anything about ${safeEscapeHtml(this.repo || 'this repository')}… (Enter to send, Shift+Enter for newline)"
              aria-label="Ask GitStory AI"
            ></textarea>
            <button type="submit" class="btn btn-primary ai-send-btn" id="ai-card-send" aria-label="Send message">
              <span>Send</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </form>
        </div>
      `;

      this.bindCardEvents();
    }

    bindCardEvents() {
      const form = this.container.querySelector('#ai-card-form');
      const textarea = this.container.querySelector('#ai-card-input');
      const clearBtn = this.container.querySelector('#ai-card-clear');
      const chipsContainer = this.container.querySelector('#ai-card-chips');

      if (form && textarea) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSendMessage(textarea.value);
          textarea.value = '';
          textarea.style.height = 'auto';
        });

        textarea.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.requestSubmit();
          }
        });

        textarea.addEventListener('input', () => {
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(140, textarea.scrollHeight) + 'px';
        });
      }

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          this.resetChat();
        });
      }

      if (chipsContainer) {
        chipsContainer.addEventListener('click', (e) => {
          const btn = e.target.closest('.ai-chip-btn');
          if (btn) {
            const prompt = btn.getAttribute('data-prompt');
            if (prompt) this.handleSendMessage(prompt);
          }
        });
      }
    }

    // ── Floating Drawer Widget ───────────────────────────────────────────────

    initFloatingDrawer() {
      // Remove any pre-existing floating drawer elements
      const oldLauncher = document.getElementById('ai-floating-launcher');
      const oldDrawer = document.getElementById('ai-floating-drawer');
      if (oldLauncher) oldLauncher.remove();
      if (oldDrawer) oldDrawer.remove();

      // Create Floating Launcher Button
      const launcher = document.createElement('button');
      launcher.id = 'ai-floating-launcher';
      launcher.className = 'ai-floating-btn';
      launcher.setAttribute('aria-label', 'Open GitStory AI Assistant');
      launcher.innerHTML = `
        <span class="ai-floating-pulse"></span>
        <span class="ai-floating-icon">🤖</span>
        <span class="ai-floating-label">Ask Qwen</span>
      `;
      document.body.appendChild(launcher);

      // Create Slide-Out Drawer Panel
      const drawer = document.createElement('aside');
      drawer.id = 'ai-floating-drawer';
      drawer.className = 'ai-drawer hidden';
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-label', 'GitStory AI Assistant Drawer');
      drawer.innerHTML = `
        <div class="ai-drawer-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="brand-mark" style="width:28px;height:28px;font-size:12px;" aria-hidden="true">Q</div>
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--color-text-primary);">GitStory AI</div>
              <div style="font-size:10px;color:var(--color-cyan);">Qwen 2.5 Coder Copilot</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="ai-ctrl-btn" id="ai-drawer-clear" title="Clear chat">🧹</button>
            <button class="ai-ctrl-btn" id="ai-drawer-close" aria-label="Close drawer">✕</button>
          </div>
        </div>

        <div class="ai-drawer-content">
          <!-- Chips -->
          <div class="ai-chips-row" id="ai-drawer-chips" style="padding:10px 12px;border-bottom:1px solid var(--color-border);">
            ${DEFAULT_SUGGESTIONS.map(s => `
              <button class="ai-chip-btn" data-prompt="${safeEscapeHtml(s.prompt)}">${s.label}</button>
            `).join('')}
          </div>

          <!-- Messages -->
          <div class="ai-messages-container" id="ai-drawer-messages" style="flex:1;">
            ${this.renderMessagesHtml()}
          </div>

          <!-- Input form -->
          <form class="ai-input-form" id="ai-drawer-form" style="padding:10px 12px;border-top:1px solid var(--color-border);">
            <textarea
              class="ai-textarea"
              id="ai-drawer-input"
              rows="1"
              placeholder="Ask Qwen about ${safeEscapeHtml(this.repo || 'this repository')}…"
              aria-label="Ask Qwen"
            ></textarea>
            <button type="submit" class="btn btn-primary ai-send-btn" id="ai-drawer-send">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </form>
        </div>
      `;
      document.body.appendChild(drawer);

      // Drawer Events
      launcher.addEventListener('click', () => this.toggleDrawer());

      const closeBtn = drawer.querySelector('#ai-drawer-close');
      if (closeBtn) closeBtn.addEventListener('click', () => this.toggleDrawer(false));

      const drawerClear = drawer.querySelector('#ai-drawer-clear');
      if (drawerClear) drawerClear.addEventListener('click', () => this.resetChat());

      const drawerChips = drawer.querySelector('#ai-drawer-chips');
      if (drawerChips) {
        drawerChips.addEventListener('click', (e) => {
          const btn = e.target.closest('.ai-chip-btn');
          if (btn) {
            const prompt = btn.getAttribute('data-prompt');
            if (prompt) this.handleSendMessage(prompt);
          }
        });
      }

      const drawerForm = drawer.querySelector('#ai-drawer-form');
      const drawerInput = drawer.querySelector('#ai-drawer-input');
      if (drawerForm && drawerInput) {
        drawerForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSendMessage(drawerInput.value);
          drawerInput.value = '';
          drawerInput.style.height = 'auto';
        });

        drawerInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            drawerForm.requestSubmit();
          }
        });

        drawerInput.addEventListener('input', () => {
          drawerInput.style.height = 'auto';
          drawerInput.style.height = Math.min(120, drawerInput.scrollHeight) + 'px';
        });
      }

      // Close drawer on Escape key
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isDrawerOpen) {
          this.toggleDrawer(false);
        }
      });
    }

    toggleDrawer(forceState) {
      this.isDrawerOpen = typeof forceState === 'boolean' ? forceState : !this.isDrawerOpen;
      const drawer = document.getElementById('ai-floating-drawer');
      const launcher = document.getElementById('ai-floating-launcher');
      if (drawer) {
        drawer.classList.toggle('hidden', !this.isDrawerOpen);
        drawer.classList.toggle('open', this.isDrawerOpen);
      }
      if (launcher) {
        launcher.classList.toggle('active', this.isDrawerOpen);
      }
      if (this.isDrawerOpen) {
        this.scrollToBottom();
        const input = document.getElementById('ai-drawer-input');
        if (input) input.focus();
      }
    }

    // ── Message Handling & API Flow ──────────────────────────────────────────

    async handleSendMessage(text) {
      const cleanText = (text || '').trim();
      if (!cleanText || this.isThinking) return;

      // Append user message
      this.messages.push({ role: 'user', content: cleanText });
      this.isThinking = true;
      this.syncMessagesView();

      try {
        if (typeof window !== 'undefined' && typeof window.apiSendChatMessage === 'function') {
          // Prepare history excluding system/internal
          const historyToSend = this.messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .slice(-6);

          const res = await window.apiSendChatMessage(this.owner, this.repo, cleanText, historyToSend);
          const reply = res.data?.reply || 'Received empty response from assistant.';
          this.messages.push({ role: 'assistant', content: reply });
        } else {
          // Fallback if API helper isn't available
          this.messages.push({
            role: 'assistant',
            content: `I received your question about **${this.owner}/${this.repo}**: "${cleanText}". (API integration offline)`,
          });
        }
      } catch (err) {
        this.messages.push({
          role: 'assistant',
          content: `⚠️ **Unable to complete request:** ${err.message || 'Server error'}. Please try asking again.`,
        });
      } finally {
        this.isThinking = false;
        this.syncMessagesView();
      }
    }

    resetChat() {
      const repoName = this.repoData.full_name || (this.owner ? `${this.owner}/${this.repo}` : 'this repository');
      this.messages = [
        {
          role: 'assistant',
          content: `Chat history reset. How can I help you explore **${repoName}**?`,
        },
      ];
      this.isThinking = false;
      this.syncMessagesView();
    }

    syncMessagesView() {
      const cardMsg = document.getElementById('ai-card-messages');
      const drawerMsg = document.getElementById('ai-drawer-messages');
      const html = this.renderMessagesHtml();

      if (cardMsg) {
        cardMsg.innerHTML = html;
      }
      if (drawerMsg) {
        drawerMsg.innerHTML = html;
      }
      this.scrollToBottom();
    }

    scrollToBottom() {
      const cardMsg = document.getElementById('ai-card-messages');
      const drawerMsg = document.getElementById('ai-drawer-messages');
      if (cardMsg) cardMsg.scrollTop = cardMsg.scrollHeight;
      if (drawerMsg) drawerMsg.scrollTop = drawerMsg.scrollHeight;
    }

    renderMessagesHtml() {
      const items = this.messages.map(m => {
        const isUser = m.role === 'user';
        const roleClass = isUser ? 'ai-msg-user' : 'ai-msg-assistant';
        const avatar = isUser ? '👤' : '🤖';
        const authorName = isUser ? 'You' : 'Qwen';
        const bodyHtml = isUser ? safeEscapeHtml(m.content) : renderMarkdownToHtml(m.content);

        return `
          <div class="ai-message-row ${roleClass}">
            <div class="ai-msg-avatar" aria-hidden="true">${avatar}</div>
            <div class="ai-msg-content">
              <div class="ai-msg-header">
                <span class="ai-msg-author">${authorName}</span>
              </div>
              <div class="ai-msg-bubble">
                ${bodyHtml}
              </div>
            </div>
          </div>
        `;
      });

      if (this.isThinking) {
        items.push(`
          <div class="ai-message-row ai-msg-assistant">
            <div class="ai-msg-avatar" aria-hidden="true">🤖</div>
            <div class="ai-msg-content">
              <div class="ai-msg-header"><span class="ai-msg-author">Qwen</span></div>
              <div class="ai-msg-bubble ai-thinking-bubble">
                <span class="ai-dot"></span>
                <span class="ai-dot"></span>
                <span class="ai-dot"></span>
                <span style="margin-left:6px;font-size:11px;color:var(--color-text-muted);">Analyzing codebase…</span>
              </div>
            </div>
          </div>
        `);
      }

      return items.join('');
    }
  }

  // ── Exports ────────────────────────────────────────────────────────────────

  return {
    AIAssistantComponent,
    renderMarkdownToHtml,
    safeEscapeHtml,
    DEFAULT_SUGGESTIONS,
  };
});
