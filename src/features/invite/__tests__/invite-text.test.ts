import {
  INVITE_URL_PLACEHOLDER,
  inviteText,
  normaliseInviteUrl,
  whatsAppShareUrl,
} from '@/features/invite/invite-text';

describe('invite text (E2)', () => {
  it('carries the link and asks to save my number', () => {
    const text = inviteText({ myPhone: '+919876543210', url: 'https://lendshelf.example/get' });
    expect(text).toBe(
      'I’m putting my books on LendShelf so friends can borrow instead of buying. Get it here: https://lendshelf.example/get. Save my number (+91 98765 43210) so you can see my shelf.'
    );
  });

  it('uses a placeholder line while no download link is configured (H1)', () => {
    const text = inviteText({ myPhone: '+919876543210', url: null });
    expect(text).toContain(INVITE_URL_PLACEHOLDER);
    expect(text).not.toMatch(/https?:/);
    expect(text).toContain('Save my number (+91 98765 43210)');
    expect(inviteText({ myPhone: '+919876543210', url: '   ' })).toContain(INVITE_URL_PLACEHOLDER);
  });

  it('still asks to save my number when it is unknown', () => {
    expect(inviteText({ myPhone: null, url: null })).toMatch(
      /Save my number so you can see my shelf\.$/
    );
  });

  it('defaults to the configured URL (unset in tests)', () => {
    expect(inviteText({ myPhone: null })).toContain(INVITE_URL_PLACEHOLDER);
    expect(normaliseInviteUrl(' https://x.example ')).toBe('https://x.example');
    expect(normaliseInviteUrl(undefined)).toBeNull();
  });

  it('opens WhatsApp with no number on web', () => {
    expect(whatsAppShareUrl('Hi & bye')).toBe('https://wa.me/?text=Hi%20%26%20bye');
  });
});
