import { seedDemo } from './demo-data.mjs';
if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production.');
console.log(await seedDemo() ? 'Created 12 clearly labeled demo users in admin/.demo/users.json. No Supabase requests or emails were sent.' : 'Existing demo users preserved. No Supabase requests or emails were sent.');
console.log('Enable ADMIN_DEMO_DATA=1 on the local admin server, sign in with a real administrator account, then choose View demo data.');
