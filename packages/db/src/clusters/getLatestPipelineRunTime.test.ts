import { jest } from '@jest/globals';

const findFirst = jest.fn();
jest.unstable_mockModule('../client', () => ({
  prisma: {
    cluster: {
      findFirst,
    },
  },
}));

let getLatestPipelineRunTime: typeof import('./getLatestPipelineRunTime').getLatestPipelineRunTime;

beforeAll(async () => {
  ({ getLatestPipelineRunTime } = await import('./getLatestPipelineRunTime'));
});

describe('getLatestPipelineRunTime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns date when cluster exists', async () => {
    const mockDate = new Date('2026-10-20T08:00:00Z');
    (findFirst as jest.Mock).mockResolvedValue({ createdAt: mockDate });

    const result = await getLatestPipelineRunTime();

    expect(result).toEqual(mockDate);
    expect(findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
  });

  it('returns null when no clusters exist', async () => {
    (findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getLatestPipelineRunTime();

    expect(result).toBeNull();
  });
});
