import { describe, it, expect } from '@jest/globals';
import { getTopicLabel, isValidTopic, CONTROLLED_TOPIC_TAGS } from '../utils/topics';

describe('topics utility', () => {
  it('contains the 9 controlled topic tags', () => {
    expect(CONTROLLED_TOPIC_TAGS).toEqual([
      'uk',
      'world',
      'politics',
      'business',
      'tech_science',
      'environment',
      'society',
      'sport',
      'culture',
    ]);
  });

  it('formats display labels accurately', () => {
    expect(getTopicLabel('uk')).toBe('UK');
    expect(getTopicLabel('world')).toBe('World');
    expect(getTopicLabel('politics')).toBe('Politics');
    expect(getTopicLabel('business')).toBe('Business');
    expect(getTopicLabel('tech_science')).toBe('Tech & Science');
    expect(getTopicLabel('environment')).toBe('Environment');
    expect(getTopicLabel('society')).toBe('Society & Life');
    expect(getTopicLabel('sport')).toBe('Sport');
    expect(getTopicLabel('culture')).toBe('Culture & Arts');
  });

  it('validates topic tags correctly', () => {
    expect(isValidTopic('politics')).toBe(true);
    expect(isValidTopic('tech_science')).toBe(true);
    expect(isValidTopic('justice')).toBe(false);
    expect(isValidTopic('invalid_tag')).toBe(false);
    expect(isValidTopic(null)).toBe(false);
  });
});
