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
      t.referralStatusEmail({ siteUrl, toFirstName: 'Ana', receiverName: 'Bo', prospect: 'P', status: 'Closed business', amount: '$1,000' }),
      t.oneOnOneConfirmEmail({ siteUrl, toFirstName: 'Ana', reporterName: 'Bo', date: 'Oct 1' }),
      t.oneOnOneRequestEmail({ siteUrl, toFirstName: 'Ana', requesterName: 'Bo', business: 'Bo Co' }),
      t.oneOnOneAnswerEmail({ siteUrl, toFirstName: 'Ana', inviteeName: 'Bo', accepted: true }),
      t.guestThanksEmail({ siteUrl, firstName: 'Gus' }),
      t.guestNoticeEmail({ siteUrl, toFirstName: 'Ana', forAdmins: true, guestName: 'Gus G', guestEmail: 'g@example.test' }),
      t.meetingReminderEmail({ siteUrl, firstName: 'Ana', when: 'Mon 8:15 AM', title: 'Regular meeting', joinUrl: 'https://zoom.example/j/1' }),
      t.visitorFollowupEmail({ siteUrl, firstName: 'Gus' }),
      t.memberFollowupEmail({ siteUrl, toFirstName: 'Ana', guests: ['Gus G'] }),
      t.meetingRecapEmail({
        siteUrl,
        firstName: 'Ana',
        meetingTitle: 'Regular meeting',
        slidesHref: `${siteUrl}/present/m1`,
        visitors: [],
        inviters: [],
        events: [],
      }),
      t.guestZoomLinkEmail({ siteUrl, firstName: 'Gus', when: 'Mon, Oct 26 at 8:15 AM PT', joinUrl: 'https://zoom.example/j/1' }),
      t.adminDigestEmail({
        siteUrl,
        firstName: 'Ana',
        week: 'Oct 13–19',
        pending: 1,
        guests: 2,
        referrals: 3,
        oneOnOnes: 4,
        closedDeals: 1,
        closedAmount: '$500',
      }),
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
    expect(t.referralStatusEmail({ siteUrl, toFirstName: 'A', receiverName: 'B', prospect: 'P', status: 'Closed business' }).text).toContain('Congratulations');
    expect(t.referralStatusEmail({ siteUrl, toFirstName: 'A', receiverName: 'B', prospect: 'P', status: 'Contacted' }).text).not.toContain('Congratulations');
  });

  it('member emails carry the preferences footer; guest emails do not', () => {
    expect(t.referralReceivedEmail({ siteUrl, toFirstName: 'A', fromName: 'B', prospect: 'P' }).text).toContain('/profile?tab=edit#email');
    expect(t.guestThanksEmail({ siteUrl, firstName: 'G' }).text).not.toContain('/profile?tab=edit#email');
  });

  it('meeting recap: visitors with contacts and who invited them, slides, presenters with their materials, member events, next meeting', () => {
    const e = t.meetingRecapEmail({
      siteUrl,
      firstName: 'Ana',
      meetingTitle: 'Regular meeting',
      slidesHref: `${siteUrl}/present/m1`,
      visitors: [
        {
          name: 'Sampada Deshpande',
          business: 'Aashvi Smiles Dental Group',
          email: 'dr@example.org',
          website: 'https://www.aashvismiles.example',
          phone: '650-495-0795',
        },
        { name: 'Kenia <Ibarra>', business: 'Peninsula Chem Dry', phone: '650-347-6972' },
      ],
      inviters: ['Shannon', 'Kristina'],
      five: {
        name: 'Ranger Kielak',
        business: 'Within Range Coaching',
        topic: 'Communication Styles',
        materials: [['Presentation (PDF)', `${siteUrl}/present/m1/material/abc`]],
      },
      ten: {
        name: 'Will Strohl',
        business: 'Upendo Ventures',
        topic: 'What is runsonUpendo?',
        materials: [['Watch the video', 'https://www.youtube.com/watch?v=abc']],
      },
      events: [{ when: 'Wed, Oct 28 · 4:00 PM', title: 'Networking mixer', href: `${siteUrl}/events/mixer`, where: 'San Carlos' }],
      next: { date: '11/02', location: 'Online: Zoom (see separate calendar invite)', five: null, ten: 'Pia Co, Pia Presenter' },
    });
    expect(e.subject).toBe('Meeting recap: Regular meeting');
    // Visitors, in the order the group writes them: name, business, email, website, phone.
    expect(e.text).toMatch(/please take a moment to welcome today’s visitors!/i);
    expect(e.text).toMatch(/Sampada Deshpande\nAashvi Smiles Dental Group\ndr@example.org\nhttps:\/\/www.aashvismiles.example\n650-495-0795/);
    expect(e.html).toContain('href="mailto:dr@example.org"');
    expect(e.html).toContain('href="https://www.aashvismiles.example"');
    expect(e.html).toContain('Kenia &lt;Ibarra&gt;');
    expect(e.text).toContain('Thanks to Shannon & Kristina for inviting our guests!');
    expect(e.text).toContain('Here are the resources and presentations we had');
    // Slides, reporting links, presentations as "Company, Person", title, materials.
    expect(e.html).toContain(`href="${siteUrl}/present/m1"`);
    expect(e.html).toContain(`href="${siteUrl}/referrals"`);
    expect(e.html).toContain(`href="${siteUrl}/one-on-ones"`);
    expect(e.text).toMatch(/5-Minute Education\nWithin Range Coaching, Ranger Kielak\nCommunication Styles/);
    expect(e.html).toContain(`href="${siteUrl}/present/m1/material/abc"`);
    expect(e.html).toContain('href="https://www.youtube.com/watch?v=abc"');
    expect(e.text).toMatch(/please be sure to support our member-hosted events/i);
    expect(e.html).toContain(`href="${siteUrl}/events/mixer"`);
    // Next meeting.
    expect(e.text).toMatch(/next meeting presenters on 11\/02/i);
    expect(e.text).toContain('Location: Online: Zoom (see separate calendar invite)');
    expect(e.text).toContain('5-Minute Educator: No one yet… Maybe YOU?');
    expect(e.text).toContain('10-Minute Presenter: Pia Co, Pia Presenter');
    expect(e.text).toContain(`Claim a spot for future presentations: ${siteUrl}/meetings`);
    expect(e.text).toContain('/profile?tab=edit#email');
  });

  it('meeting recap with one visitor and one inviter, no presenters or events, still reads well', () => {
    const e = t.meetingRecapEmail({
      siteUrl,
      firstName: 'Ana',
      meetingTitle: 'M',
      slidesHref: `${siteUrl}/present/m`,
      visitors: [{ name: 'Jennifer McKay' }],
      inviters: ['Shannon'],
      events: [],
    });
    expect(e.text).toContain('Thanks to Shannon for inviting our guest!');
    expect(e.text).toContain('No member events are on the calendar');
    expect(e.text).not.toMatch(/next meeting presenters/i);
    const none = t.meetingRecapEmail({
      siteUrl,
      firstName: 'Ana',
      meetingTitle: 'M',
      slidesHref: `${siteUrl}/present/m`,
      visitors: [],
      inviters: [],
      events: [],
    });
    expect(none.text).not.toMatch(/welcome today’s visitors/i);
  });

  it('guest Zoom link email: the join button, meeting time, passcode when there is one, what to bring', () => {
    const e = t.guestZoomLinkEmail({
      siteUrl,
      firstName: 'Kenia',
      when: 'Mon, Oct 26 at 8:15 AM PT',
      joinUrl: 'https://zoom.example/j/1?pwd=x',
      passcode: '123456',
    });
    expect(e.subject).toBe('Your Zoom link for Bay Area Referral Partners, Mon, Oct 26 at 8:15 AM PT');
    expect(e.html).toContain('href="https://zoom.example/j/1?pwd=x"');
    expect(e.text).toContain('Join on Zoom: https://zoom.example/j/1?pwd=x');
    expect(e.text).toContain('Passcode: 123456');
    expect(e.text).toContain('60-second introduction');
    expect(e.text).not.toContain('/profile?tab=edit#email');
    expect(t.guestZoomLinkEmail({ siteUrl, firstName: 'K', when: 'W', joinUrl: 'https://zoom.example/j/1' }).text).not.toContain('Passcode');
  });
});
