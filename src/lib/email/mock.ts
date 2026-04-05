import type { EmailProvider } from './types';

export class MockEmailService implements EmailProvider {
  async send(
    to: string,
    subject: string,
    html: string,
    unsubscribeToken?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log('📧 [MockEmail] Sending email:');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Unsubscribe token: ${unsubscribeToken || 'none'}`);
    console.log(`  HTML length: ${html.length} chars`);
    console.log(`  Message ID: ${messageId}`);

    return { success: true, messageId };
  }

  async sendBatch(
    recipients: string[],
    subject: string,
    html: string,
    unsubscribeTokens?: Map<string, string>
  ): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
    console.log(`📧 [MockEmail] Sending batch:`);
    console.log(`  Recipients: ${recipients.length}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  HTML length: ${html.length} chars`);

    for (const email of recipients) {
      const token = unsubscribeTokens?.get(email);
      console.log(`  - ${email} (token: ${token ? 'yes' : 'no'})`);
    }

    return {
      success: true,
      sent: recipients.length,
      failed: 0,
    };
  }
}
