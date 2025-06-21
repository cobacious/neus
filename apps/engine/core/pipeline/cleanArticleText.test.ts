import { cleanArticleText } from './cleanArticleText';

describe('cleanArticleText', () => {
  it('strips HTML tags', () => {
    const input = '<div>Hello <strong>World</strong></div>';
    expect(cleanArticleText(input)).toBe('Hello World');
  });

  it('removes ad and navigation text', () => {
    const input = 'Advertisement Skip to main content News content';
    expect(cleanArticleText(input)).toBe('News content');
  });

  it('normalises whitespace and punctuation', () => {
    const input = 'Hello    world ,  how are you ?';
    expect(cleanArticleText(input)).toBe('Hello world, how are you?');
  });
});
