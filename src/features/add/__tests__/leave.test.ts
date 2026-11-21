import { discardCopy, leaveDecision } from '@/features/add/leave';

// QA-ANDROID bug 3: hardware Back in Add books closed the modal and lost the scan queue.
describe('Back in Add books', () => {
  it('goes back from Review to the queue instead of closing', () => {
    expect(
      leaveDecision({ step: 'confirm', confirmOrigin: 'scan', queued: 2, typed: false })
    ).toEqual({ kind: 'stepBack' });
    expect(
      leaveDecision({ step: 'confirm', confirmOrigin: 'search', queued: 0, typed: false })
    ).toEqual({ kind: 'stepBack' });
  });

  it('closes from a confirm opened with "I own this" (no earlier step)', () => {
    expect(
      leaveDecision({ step: 'confirm', confirmOrigin: 'work', queued: 0, typed: false })
    ).toEqual({ kind: 'leave' });
  });

  it('asks before discarding a scan queue or typed text', () => {
    expect(leaveDecision({ step: 'pick', queued: 1, typed: false })).toEqual({
      kind: 'confirm',
      queued: 1,
      typed: false,
    });
    expect(leaveDecision({ step: 'pick', queued: 0, typed: true })).toEqual({
      kind: 'confirm',
      queued: 0,
      typed: true,
    });
  });

  it('closes when there is nothing to lose', () => {
    expect(leaveDecision({ step: 'pick', queued: 0, typed: false })).toEqual({ kind: 'leave' });
    expect(leaveDecision({ step: 'done', queued: 3, typed: false })).toEqual({ kind: 'leave' });
    expect(leaveDecision({ step: 'work', queued: 0, typed: false })).toEqual({ kind: 'leave' });
  });

  it('words the confirm as the spec does (E8)', () => {
    expect(discardCopy(1, false)).toMatchObject({
      title: 'Discard 1 scanned book?',
      keep: 'Keep scanning',
    });
    expect(discardCopy(3, false).title).toBe('Discard 3 scanned books?');
    expect(discardCopy(0, true)).toMatchObject({
      title: 'Discard this book?',
      keep: 'Keep editing',
    });
  });
});
