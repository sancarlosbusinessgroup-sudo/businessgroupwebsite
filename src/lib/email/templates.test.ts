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

  it('a one-on-one message and a decline carry the invitee’s message, escaped (owner, 2026-10-24)', () => {
    const m = t.oneOnOneMessageEmail({ siteUrl, toFirstName: 'Ana', inviteeName: 'Bo', message: 'Away <until> the 10th' });
    expect(m.subject).toBe('Bo sent you a message about your one-on-one request');
    expect(m.html).toContain('Away &lt;until&gt; the 10th');
    expect(m.text).toContain('Away <until> the 10th');
    const d = t.oneOnOneAnswerEmail({ siteUrl, toFirstName: 'Ana', inviteeName: 'Bo', accepted: false, message: 'Busy this month' });
    expect(d.text).toContain('Busy this month');
    expect(t.oneOnOneAnswerEmail({ siteUrl, toFirstName: 'Ana', inviteeName: 'Bo', accepted: false }).text).not.toContain('Their message');
  });

  it('a closed business filed afterwards tells the receiver it is already recorded as closed (owner, 2026-10-25)', () => {
    const e = t.referralReceivedEmail({ siteUrl, toFirstName: 'Ana', fromName: 'Bo', prospect: 'Kitchen <remodel>', amount: '$12,500', closed: true });
    expect(e.subject).toBe('Closed business recorded from Bo: Kitchen <remodel>');
    expect(e.text).toContain('already closed business');
    expect(e.text).toContain('Value: $12,500');
    expect(e.text).toContain('/closed-business');
    expect(e.text).not.toContain('Reach out soon');
    expect(e.html).toContain('Kitchen &lt;remodel&gt;');
  });

  it('every template has a subject, a lang attribute, a link to the site and a plain-text twin', () => {
    const all: t.Email[] = [
      t.welcomeEmail({ siteUrl, firstName: 'Ana' }),
      t.onboardingReminderEmail({ siteUrl, firstName: 'Ana' }),
      t.referralReceivedEmail({ siteUrl, toFirstName: 'Ana', fromName: 'Bo', prospect: 'P' }),
      t.referralReceivedEmail({ siteUrl, toFirstName: 'Ana', fromName: 'Bo', prospect: 'P', closed: true }),
      t.referralStatusEmail({ siteUrl, toFirstName: 'Ana', receiverName: 'Bo', prospect: 'P', status: 'Closed business', amount: '$1,000' }),
      t.oneOnOneConfirmEmail({ siteUrl, toFirstName: 'Ana', reporterName: 'Bo', date: 'Oct 1' }),
      t.oneOnOneRequestEmail({ siteUrl, toFirstName: 'Ana', requesterName: 'Bo', business: 'Bo Co' }),
      t.oneOnOneAnswerEmail({ siteUrl, toFirstName: 'Ana', inviteeName: 'Bo', accepted: true }),
      t.oneOnOneMessageEmail({ siteUrl, toFirstName: 'Ana', inviteeName: 'Bo', message: 'Travelling, sorry!' }),
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
      t.presentationReminderEmail({
        siteUrl,
        firstName: 'Laura',
        slot: 'presentation',
        when: 'Mon, Nov 9 at 8:15 AM PT',
        title: 'Regular meeting',
        topic: 'Prep 101',
      }),
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

  it('presentation reminder names the slot, the topic or asks for one, and always goes out (no preferences footer)', () => {
    const withTopic = t.presentationReminderEmail({
      siteUrl,
      firstName: 'Laura',
      slot: 'presentation',
      when: 'Mon, Nov 9 at 8:15 AM PT',
      title: 'M',
      topic: 'Prep 101',
    });
    expect(withTopic.subject).toBe('Your 10-Minute Presentation is in 5 days: Mon, Nov 9 at 8:15 AM PT');
    expect(withTopic.text).toContain('Prep 101');
    expect(withTopic.text).toContain('10 minutes');
    expect(withTopic.text).not.toContain('/profile?tab=edit#email');
    const noTopic = t.presentationReminderEmail({ siteUrl, firstName: 'David', slot: 'education', when: 'Mon', title: 'M' });
    expect(noTopic.subject).toContain('5-Minute Member Education');
    expect(noTopic.text).toContain('Not added yet');
    expect(noTopic.html).toContain('Add your topic');
    expect(noTopic.html).toContain(`${siteUrl}/meetings`);
  });

  it('closed-deal update congratulates the giver', () => {
    expect(t.referralStatusEmail({ siteUrl, toFirstName: 'A', receiverName: 'B', prospect: 'P', status: 'Closed business' }).text).toContain('Congratulations');
    expect(t.referralStatusEmail({ siteUrl, toFirstName: 'A', receiverName: 'B', prospect: 'P', status: 'Contacted' }).text).not.toContain('Congratulations');
  });

  it('member emails carry the preferences footer; guest emails do not', () => {
    expect(t.referralReceivedEmail({ siteUrl, toFirstName: 'A', fromName: 'B', prospect: 'P' }).text).toContain('/profile?tab=edit#email');
    expect(t.guestThanksEmail({ siteUrl, firstName: 'G' }).text).not.toContain('/profile?tab=edit#email');
  });

  it('guest thank-you: says which member invited them when a member filled in the request (owner, 2026-10-30)', () => {
    const byMember = t.guestThanksEmail({ siteUrl, firstName: 'Gina', meeting: 'Monday, November 9 at 8:15 AM', invitedBy: 'Morgan Member' });
    expect(byMember.subject).toContain('Morgan Member invited you to visit');
    expect(byMember.text).toContain('Morgan Member invited you to visit');
    expect(byMember.text).toContain('on Monday, November 9');
    const own = t.guestThanksEmail({ siteUrl, firstName: 'Gina' });
    expect(own.subject).toContain('Thanks for your interest');
    expect(own.text).toContain('received your request');
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

describe('management recap email (owner, 2026-10-30)', () => {
  const base: t.ManagementRecap = {
    meetingTitle: 'Networking',
    meetingWhen: 'Monday, November 9',
    taken: { source: 'zoom' },
    totalMembers: 5,
    present: ['Ana Ames', 'Bo Bell'],
    substitutes: ['Cy Cole'],
    excused: [],
    absent: ['Di Dunn', 'Ed Eke'],
    late: ['Bo Bell'],
    leftEarly: [],
    visitors: [{ name: 'Vera Visitor', business: 'Vera Dental', invitedBy: 'Ana Ames', email: 'vera@example.org', phone: '650-555-0100', signedIn: true }],
    atLimit: [{ name: 'Ed Eke', missed: 2 }],
    unmatchedZoom: 3,
    pendingApplications: 1,
    guestsAwaitingOneOnOnes: ['Vera Visitor'],
    next: { when: 'Monday, November 23 at 8:15 AM', openSlots: ['10-minute'] },
  };

  it('shows attendance, visitors and the notes for the team', () => {
    const e = t.managementRecapEmail({ siteUrl, firstName: 'Viv', ...base });
    expect(e.subject).toBe('Management recap: Monday, November 9');
    expect(e.text).toContain('Members present: 3 of 5 (from Zoom)');
    expect(e.text).toContain('Present: Ana Ames, Bo Bell');
    expect(e.text).toContain('Sent a substitute: Cy Cole');
    expect(e.text).toContain('Late (after 8:30): Bo Bell');
    expect(e.text).toContain('Absent: Di Dunn, Ed Eke');
    expect(e.text).toContain('Signed in at the meeting');
    expect(e.text).toContain('Invited by: Ana Ames');
    expect(e.text).toContain('Ed Eke has missed 2 meetings in the last 6 months');
    expect(e.text).toContain('3 Zoom names need matching');
    expect(e.text).toContain('1 membership application is waiting');
    expect(e.text).toContain('the 10-minute slot is still open');
    expect(e.text).not.toContain('has not been taken');
    expect(e.html).toContain(`${siteUrl}/admin/attendance`);
  });

  it('warns when attendance has not been taken, and reads well with nothing to report', () => {
    const e = t.managementRecapEmail({
      siteUrl,
      firstName: 'Viv',
      ...base,
      taken: null,
      visitors: [],
      atLimit: [],
      unmatchedZoom: 0,
      pendingApplications: 0,
      guestsAwaitingOneOnOnes: [],
      next: null,
    });
    expect(e.text).toContain('Attendance has not been taken for this meeting yet');
    expect(e.text).toContain('No visitors were recorded');
    expect(e.text).toContain('Nothing needs attention right now.');
  });
});
