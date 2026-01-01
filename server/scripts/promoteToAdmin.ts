/**
 * Script to promote a user to admin role
 *
 * Usage: npx tsx server/scripts/promoteToAdmin.ts <email>
 *
 * Example: npx tsx server/scripts/promoteToAdmin.ts dylanmerlo@gmail.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function promoteToAdmin(email: string): Promise<void> {
  console.log(`\nPromoting user "${email}" to admin role...\n`);

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!existingUser) {
      console.error(`Error: User with email "${email}" not found.`);
      console.log('\nAvailable users:');
      const users = await prisma.user.findMany({
        select: { email: true, name: true, role: true },
        take: 10,
      });
      users.forEach(u => console.log(`  - ${u.email} (${u.name || 'no name'}) [${u.role}]`));
      process.exit(1);
    }

    if (existingUser.role === 'admin') {
      console.log(`User "${email}" is already an admin.`);
      process.exit(0);
    }

    // Update user role to admin
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'admin' },
      select: { id: true, email: true, name: true, role: true },
    });

    console.log('Success! User promoted to admin:');
    console.log(`  ID:    ${updatedUser.id}`);
    console.log(`  Email: ${updatedUser.email}`);
    console.log(`  Name:  ${updatedUser.name || '(not set)'}`);
    console.log(`  Role:  ${updatedUser.role}`);
    console.log('\nThe user can now access the admin dashboard.\n');

  } catch (error) {
    console.error('Failed to promote user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx server/scripts/promoteToAdmin.ts <email>');
  console.error('Example: npx tsx server/scripts/promoteToAdmin.ts dylanmerlo@gmail.com');
  process.exit(1);
}

promoteToAdmin(email);
