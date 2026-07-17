import { describe, expect, it } from 'vitest';
import { renderPassageHtml, renderFootnoteHtml, shuffleArray } from '../course.js';

describe('renderPassageHtml', () => {
  it('高亮 passage 中的目标词', () => {
    const html = renderPassageHtml('The eminent author wrote.', ['eminent']);
    expect(html).toContain('<em class="highlight">eminent</em>');
  });

  it('空词表时不死循环', () => {
    const html = renderPassageHtml('Plain text only.', []);
    expect(html).toBe('Plain text only.');
  });

  it('无匹配时返回转义原文', () => {
    const html = renderPassageHtml('Hello <world>', ['missing']);
    expect(html).toContain('Hello &lt;world&gt;');
  });
});

describe('renderFootnoteHtml', () => {
  it('将 click here 渲染为可跳转按钮', () => {
    const html = renderFootnoteHtml({
      text: "(*replete—if you've forgotten the meaning, click here)",
      links: [{ word: 'replete', targetId: 'w1-d1' }],
    });
    expect(html).toContain('class="cross-ref"');
    expect(html).toContain('data-target-id="w1-d1"');
    expect(html).toContain('click here</button>');
  });

  it('支持同一段落内多个 click here', () => {
    const html = renderFootnoteHtml({
      text: '(*compound—click here; *badgered—click here)',
      links: [
        { word: 'compound', targetId: 'w1-d3' },
        { word: 'badgered', targetId: 'w1-d4' },
      ],
    });
    expect(html.match(/data-target-id="w1-d3"/g)).toHaveLength(1);
    expect(html.match(/data-target-id="w1-d4"/g)).toHaveLength(1);
  });
});

describe('shuffleArray', () => {
  it('返回相同长度的新数组', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffleArray(arr)).toHaveLength(5);
    expect(arr).toHaveLength(5);
  });

  it('包含全部元素', () => {
    const arr = ['a', 'b', 'c'];
    const shuffled = shuffleArray(arr);
    expect([...shuffled].sort()).toEqual(['a', 'b', 'c']);
  });
});
