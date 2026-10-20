import { describe, expect, it } from 'vitest';
import * as t from './templates';

const siteUrl = 'https://example.test';

describe('email templates', () => {
  it('escapes HTML in member-supplied text', () => {
    const e = t.referralReceivedEmail({ siteUrl, toFirstName: 'Ana', fromName: 'Bo <script>', prospect: 'X & Y', notes: '<b>hi</b>' });
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('Bo &lt;script&gt;');
    expect(e.html).toContain('X &amp; Y');
    expect(e.html).toContain('&lt;b&gt;hi&lt;/b&gt;');
    expect(e.text).toContain('Prospect: X & Y');
  });

  it('every template has a subject, a lang attribute, a link to the site and a plain-text twin', () => {
    const all: t.Email[] = [
      t.welcomeEmail({ siteUrl, firstName: 'Ana' }),
      t.onboardingReminderEmail({ siteUrl, firstName: 'Ana' }),
      t.referralReceivedEmail({ siteUrl, toFirstName: 'Ana', fromName: 'Bo', prospect: 'P' }),
      t.referralStatusEmail({ siteUrl, toFirstName: 'Ana', receiverName: 'Bo', prospect: 'P', status: 'Closed deal', amount: '$1,000' }),
      t.oneOnOneConfirmEmail({ siteUrl, toFirstName: 'Ana', reporterName: 'Bo', date: 'Oct 1' }),
      t.oneOnOneRequestEmail({ siteUrl, toFirstName: 'Ana', requesterName: 'Bo', business: 'Bo Co' }),
      t.oneOnOneAnswerEmail({ siteUrl, toFirstName: 'Ana', inviteeName: 'Bo', accepted: true }),
      t.guestThanksEmail({ siteUrl, firstName: 'Gus' }),
      t.guestNoticeEmail({ siteUrl, toFirstName: 'Ana', forAdmins: true, guestName: 'Gus G', guestEmail: 'g@example.test' }),
      t.meetingReminderEmail({ siteUrl, firstName: 'Ana', when: 'Mon 8:15 AM', title: 'Regular meeting', joinUrl: 'https://zoom.example/j/1' }),
      t.visitorFollowupEmail({ siteUrl, firstName: 'Gus' }),
      t.memberFollowupEmail({ siteUrl, toFirstName: 'Ana', guests: ['Gus G'] }),
      t.adminDigestEmail({ siteUrl, firstName: 'Ana', week: 'Oct 13–19', pending: 1, guests: 2, referrals: 3, oneOnOnes: 4, closedDeals: 1, closedAmount: '$500' }),
    ];
    for (const e of all) {
      expect(e.subject.length).toBeGreaterThan(5);
      expect(e.html).toContain('<html lang="en">');
      expect(e.html).toContain(siteUrl);
      expect(e.text.length).toBeGreaterThan(20);
      expect(e.text).not.toContain('<');
    }
  });

  it('welcome email links to onboarding', () => {
    const e = t.welcomeEmail({ siteUrl, firstName: 'Ana' });
    expect(e.html).toContain(`${siteUrl}/onboarding`);
    expect(e.text).toContain(`${siteUrl}/onboarding`);
  });

  it('meeting reminder uses the Zoom link as the button when there is one', () => {
    const withLink = t.meetingReminderEmail({ siteUrl, firstName: 'Ana', when: 'Mon', title: 'M', joinUrl: 'https://zoom.example/j/1', ten: 'Laura Biche' });
    expect(withLink.html).toContain('href="https://zoom.example/j/1"');
    expect(withLink.text).toContain('Laura Biche');
    const without = t.meetingReminderEmail({ siteUrl, firstName: 'Ana', when: 'Mon', title: 'M' });
    expect(without.html).toContain(`${siteUrl}/meetings`);
    expect(without.text).toContain('Open');
  });

  it('closed-deal update congratulates the giver', () => {
    expect(t.referralStatusEmail({ siteUrl, toFirstName: 'A', receiverName: 'B', prospect: 'P', status: 'Closed deal' }).text).toContain('Congratulations');
    expect(t.referralStatusEmail({ siteUrl, toFirstName: 'A', receiverName: 'B', prospect: 'P', status: 'Contacted' }).text).not.toContain('Congratulations');
  });

  it('member emails carry the preferences footer; guest emails do not', () => {
    expect(t.referralReceivedEmail({ siteUrl, toFirstName: 'A', fromName: 'B', prospect: 'P' }).text).toContain('/profile?tab=edit#email');
    expect(t.guestThanksEmail({ siteUrl, firstName: 'G' }).text).not.toContain('/profile?tab=edit#email');
  });
});
