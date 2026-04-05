import nodemailer from 'nodemailer';
import type { EmailProvider } from './types';

export class BrevoEmailService implements EmailProvider {
  private transporter: nodemailer.Transporter;

  constructor() {
    const host = process.env.BREVO_SMTP_HOST;
    const user = process.env.BREVO_SMTP_USER;
    const pass = process.env.BREVO_SMTP_PASS;

    if (!host || !user || !pass) {
      throw new Error(
        'BREVO_SMTP_HOST, BREVO_SMTP_USER, and BREVO_SMTP_PASS environment variables are required'
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: 587,
      secure: false,
      auth: {
        user,
        pass,
      },
    });
  }

  async send(
    to: string,
    subject: string,
    html: string,
    unsubscribeToken?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const fromEmail = process.env.FROM_EMAIL || 'noreply@mikemcmahon.dev';
      const siteUrl = process.env.SITE_URL || 'https://mikemcmahon.dev';

      const response = await this.transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
        headers: unsubscribeToken
          ? {
              'List-Unsubscribe': `<${new URL(
                `/api/unsubscribe?token=${unsubscribeToken}`,
                siteUrl
              )}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            }
          : undefined,
      });

      return { success: true, messageId: response.messageId };
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
