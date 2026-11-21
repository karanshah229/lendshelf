import { cardLabel, clipText, orList, sentences } from '@/lib/a11y';

describe('orList', () => {
  it('joins one, two and three actions', () => {
    expect(orList([])).toBe('');
    expect(orList(['Accept'])).toBe('Accept');
    expect(orList(['Accept', 'decline'])).toBe('Accept or decline');
    expect(orList(['Accept', 'decline', 'message Asha'])).toBe('Accept, decline or message Asha');
  });

  it('skips empty entries', () => {
    expect(orList(['Got it back', ' ', ''])).toBe('Got it back');
  });
});

describe('sentences', () => {
  it('capitalises, adds one full stop and skips empty parts', () => {
    expect(sentences(['due 12 Dec', null, '', undefined, false, 'in 3 days'])).toBe(
      'Due 12 Dec. In 3 days.'
    );
  });

  it('keeps existing end punctuation', () => {
    expect(sentences(['Cancel your request to Kabir?', 'Sending…', 'Done.'])).toBe(
      'Cancel your request to Kabir? Sending… Done.'
    );
  });
});

describe('cardLabel', () => {
  it('reads title, status, then the actions in visual order', () => {
    expect(
      cardLabel({
        title: 'Asha Rao wants Sapiens',
        context: 'expires in 2 days',
        actions: ['Accept', 'Decline'],
      })
    ).toBe('Asha Rao wants Sapiens. Expires in 2 days. Accept or decline.');
  });

  it('says overdue in words and includes the note', () => {
    expect(
      cardLabel({
        title: 'Animal Farm with Kabir Shah',
        context: '3 days overdue',
        note: 'Not in your contacts · +91 90000 00004',
        actions: ['Nudge on WhatsApp', 'Got it back', 'Change due date'],
      })
    ).toBe(
      'Animal Farm with Kabir Shah. 3 days overdue. Not in your contacts · +91 90000 00004. Nudge on WhatsApp, got it back or change due date.'
    );
  });

  it('keeps "I’ve" capitalised and copes with no actions', () => {
    expect(
      cardLabel({ title: 'Sapiens from Ravi', actions: ['Ask for more time', 'I’ve returned it'] })
    ).toBe('Sapiens from Ravi. Ask for more time or I’ve returned it.');
    expect(cardLabel({ title: 'Your request to Ravi expires tomorrow', context: null })).toBe(
      'Your request to Ravi expires tomorrow.'
    );
  });
});

describe('clipText', () => {
  it('leaves short text alone and shortens long text with an ellipsis', () => {
    expect(clipText('  Can I borrow it?  ', 60)).toBe('Can I borrow it?');
    const long = 'Could I pick it up on Saturday morning before the market, or Sunday after lunch?';
    const clipped = clipText(long, 30);
    expect(clipped.length).toBeLessThanOrEqual(30);
    expect(clipped.endsWith('…')).toBe(true);
    expect(long.startsWith(clipped.slice(0, -1))).toBe(true);
  });
});
