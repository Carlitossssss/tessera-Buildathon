import type { Job } from 'bullmq';
import { sendEmail } from '../services/email.js';

export async function processEmailJob(
  job: Job<{ to: string; subject: string; html: string; text?: string }>,
) {
  await sendEmail(job.data);
}
