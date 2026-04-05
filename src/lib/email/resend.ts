import { Resend } from 'resend';
import type { EmailProvider } from './types';

export class ResendEmailService implements EmailProvider {
  private resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    this.resend = new Resend(apiKey);
  }

  async send(
    to: string,
    subject: string,
    html: string,
    unsubscribeToken?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const fromEmail = process.env.FROM_EMAIL || 'noreply@mikemcmahon.dev';

      const response = await this.resend.emails.send({
        from: fromEmail,
        to,
        subject,
        html,
        headers: unsubscribeToken
          ? {
              'List-Unsubscribe': `<${new URL(
                `/api/unsubscribe?token=${unsubscribeToken}`,
                process.env.SITE_URL || 'https://mikemcmahon.dev'
              )}>`,
            }
          : undefined,
      });

      if (response.error) {
        return { success: false, error: response.error.message };
      }

      return { success: true, messageId: response.data?.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendBatch(
    recipients: string[],
    subject: string,
    html: string,
    unsubscribeTokens?: Map<string, string>
  ): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
    let sent = 0;
    let failed = 0;

    for (const email of recipients) {
      const token = unsubscribeTokens?.get(email);
      const result = await this.send(email, subject, html, token);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return {
      success: failed === 0,
      sent,
      failed,
    };
  }
}
