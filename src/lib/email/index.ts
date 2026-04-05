import { ResendEmailService } from './resend';
import { BrevoEmailService } from './brevo';
import { MockEmailService } from './mock';
import type { EmailProvider } from './types';

export { type EmailProvider } from './types';

export function createEmailService(provider?: string): EmailProvider {
  const selectedProvider = provider || process.env.EMAIL_PROVIDER || 'mock';

  switch (selectedProvider.toLowerCase()) {
    case 'resend':
      return new ResendEmailService();
    case 'brevo':
      return new BrevoEmailService();
    case 'mock':
      return new MockEmailService();
    default:
      throw new Error(
        `Unknown EMAIL_PROVIDER: ${selectedProvider}. Must be one of: resend, brevo, mock`
      );
  }
}
