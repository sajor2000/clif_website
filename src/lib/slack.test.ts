import { describe, expect, it } from 'vitest';
import { buildLosRequestSlackMessage } from './slack';

describe('buildLosRequestSlackMessage', () => {
  const base = {
    grantTitle: 'Early mobilization <trial> & outcomes',
    grantType: 'R01',
    grantDeadline: '2027-02-05',
    applicantPi: 'Jane Doe, MD',
    applicantInstitution: 'the University of Chicago',
    requestedBy: 'Jane Doe',
    piCount: 12,
    requestUrl: 'https://clif-icu.com/portal/los-requests?request=abc',
  };

  it('links the title, escapes mrkdwn and pings the channel', () => {
    const msg = buildLosRequestSlackMessage(base) as any;
    expect(msg.text).toBe('New letter of collaboration request: Early mobilization <trial> & outcomes');
    expect(msg.blocks[0].text.text).toContain('<!channel>');
    expect(msg.blocks[0].text.text).toContain(
      '<https://clif-icu.com/portal/los-requests?request=abc|Early mobilization &lt;trial&gt; &amp; outcomes>',
    );
    expect(msg.blocks[1].elements[0].text).toBe(
      '*R01*  ·  PI *Jane Doe, MD*, the University of Chicago  ·  Grant deadline *Feb 5, 2027*  ·  Requested by *Jane Doe*',
    );
    expect(msg.blocks[2].text.text).toContain('Site PIs (12) have been emailed');
    expect(msg.blocks[3].elements[0].url).toBe(base.requestUrl);
  });

  it('calls out when no site PI is flagged', () => {
    const msg = buildLosRequestSlackMessage({ ...base, piCount: 0 }) as any;
    expect(msg.blocks[2].text.text).toContain('No site PIs are flagged yet');
  });
});
