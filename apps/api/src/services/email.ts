import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const client = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : undefined;

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: Record<string, string>;
}): Promise<void> {
  if (!client) {
    logger.info({ to: opts.to, subject: opts.subject }, '[email/mock] enviando');
    return;
  }
  const res = await client.emails.send({
    from: env.RESEND_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    tags: opts.tags
      ? Object.entries(opts.tags).map(([name, value]) => ({ name, value }))
      : undefined,
  });
  if (res.error) {
    throw new Error(`Resend error: ${res.error.message}`);
  }
}
