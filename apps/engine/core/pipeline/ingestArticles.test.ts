import { cleanArticleTitle } from './ingestArticles';

describe('cleanArticleTitle', () => {
  it('strips publication suffix matching source name', () => {
    expect(
      cleanArticleTitle(
        'Greens can take comfort from Holborn, but questions for Reform - The Times',
        'The Times'
      )
    ).toBe('Greens can take comfort from Holborn, but questions for Reform');
  });

  it('strips dash and em-dash variations', () => {
    expect(
      cleanArticleTitle(
        'Chancellor unveils new autumn budget measures — Financial Times',
        'Financial Times'
      )
    ).toBe('Chancellor unveils new autumn budget measures');
  });

  it('strips Google News suffix if present', () => {
    expect(
      cleanArticleTitle(
        'UK inflation drops to 2.2% in September - Google News',
        'BBC News'
      )
    ).toBe('UK inflation drops to 2.2% in September');
  });

  it('leaves title intact if no matching suffix', () => {
    expect(
      cleanArticleTitle(
        'Starmer faces rebellion over welfare bill',
        'The Guardian'
      )
    ).toBe('Starmer faces rebellion over welfare bill');
  });
});
