import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const adminAlertResolutions = pgTable(
  'admin_alert_resolutions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    alertId: varchar('alert_id', { length: 260 }).notNull(),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('admin_alert_resolutions_alert_id_key').on(t.alertId),
    index('admin_alert_resolutions_resolved_at_idx').on(t.resolvedAt),
  ],
);
