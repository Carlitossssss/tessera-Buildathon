import './load-env.js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no esta definido');
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('Aplicando migraciones...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migraciones aplicadas.');

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
