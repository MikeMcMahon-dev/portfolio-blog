export interface EmailProvider {
  send(
    to: string,
    subject: string,
    html: string,
    unsubscribeToken?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }>;

  sendBatch(
    recipients: string[],
    subject: string,
    html: string,
    unsubscribeTokens?: Map<string, string>
  ): Promise<{ success: boolean; sent: number; failed: number; error?: string }>;
}
