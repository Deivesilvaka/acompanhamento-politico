import { escapeHtml } from '@src/shared/helpers/html-escape.helper';
import { toContainsPattern } from '@src/shared/helpers/like-pattern.helper';

describe('escapeHtml', () => {
  it('neutraliza HTML injection', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
    expect(escapeHtml("'&")).toBe('&#39;&amp;');
    expect(escapeHtml(null)).toBe('');
  });
});

describe('toContainsPattern', () => {
  it('escapa curingas do LIKE', () => {
    expect(toContainsPattern('100%_a')).toBe('%100\\%\\_a%');
  });
});
