/**
 * ai-assistant.test.js
 * Unit tests for GitStory AI Markdown parser and assistant helpers.
 * Run with: node --test frontend/tests/ai-assistant.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  renderMarkdownToHtml,
  safeEscapeHtml,
  DEFAULT_SUGGESTIONS,
} = require('../assets/js/ai-assistant.js');

test('AI Assistant: safeEscapeHtml escapes HTML characters safely', () => {
  assert.equal(safeEscapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(safeEscapeHtml(null), '');
  assert.equal(safeEscapeHtml(undefined), '');
});

test('AI Assistant: renderMarkdownToHtml parses bold and italic text', () => {
  const input = 'This is **bold** and this is *italic*.';
  const html = renderMarkdownToHtml(input);
  assert.ok(html.includes('<strong>bold</strong>'));
  assert.ok(html.includes('<em>italic</em>'));
});

test('AI Assistant: renderMarkdownToHtml parses inline code and code blocks with copy buttons', () => {
  const inline = 'Run `git status` to check.';
  const inlineHtml = renderMarkdownToHtml(inline);
  assert.ok(inlineHtml.includes('<code class="ai-inline-code">git status</code>'));

  const block = "```python\ndef hello():\n    return 'world'\n```";
  const blockHtml = renderMarkdownToHtml(block);
  assert.ok(blockHtml.includes('<div class="ai-code-wrapper">'));
  assert.ok(blockHtml.includes('<span class="ai-code-lang">python</span>'));
  assert.ok(blockHtml.includes('ai-copy-btn'));
  assert.ok(blockHtml.includes("def hello():"));
});

test('AI Assistant: renderMarkdownToHtml parses headers and bullet lists', () => {
  const md = "### Architecture\n- Core module\n- API router";
  const html = renderMarkdownToHtml(md);
  assert.ok(html.includes('<h4 class="ai-h4">Architecture</h4>'));
  assert.ok(html.includes('<ul class="ai-list">'));
  assert.ok(html.includes('<li>Core module</li>'));
  assert.ok(html.includes('<li>API router</li>'));
});

test('AI Assistant: renderMarkdownToHtml safely parses links with target _blank', () => {
  const md = 'Visit [GitHub](https://github.com/pallets/flask) for code.';
  const html = renderMarkdownToHtml(md);
  assert.ok(html.includes('href="https://github.com/pallets/flask"'));
  assert.ok(html.includes('target="_blank"'));
  assert.ok(html.includes('GitHub ↗'));
});

test('AI Assistant: renderMarkdownToHtml neutralizes XSS inside Markdown', () => {
  const dangerous = '<img src=x onerror=alert(1)> and **safe**';
  const html = renderMarkdownToHtml(dangerous);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('<strong>safe</strong>'));
});

test('AI Assistant: DEFAULT_SUGGESTIONS has valid prompts', () => {
  assert.ok(Array.isArray(DEFAULT_SUGGESTIONS));
  assert.ok(DEFAULT_SUGGESTIONS.length >= 4);
  DEFAULT_SUGGESTIONS.forEach(s => {
    assert.ok(s.label && s.label.length > 0);
    assert.ok(s.prompt && s.prompt.length > 0);
  });
});
