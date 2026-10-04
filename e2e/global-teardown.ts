import { PrismaClient } from "@prisma/client"

/**
 * Playwright global teardown.
 *
 * E2E suites create real user rows (some via the register UI, some directly
 * via Prisma) and each run uses a unique timestamped email. Individual suites
 * delete their own users in `afterAll`, but the shared account created by
 * `auth.setup.ts` is needed for the whole run — so it is cleaned up here,
 * after every project finishes.
 *
 * We delete *all* accounts on the dedicated test domain rather than the single
 * setup email, which also sweeps up any accounts leaked by earlier runs that
 * would otherwise fill the database.
 */
const TEST_EMAIL_DOMAIN = "@test.grandwealth.app"

export default async function globalTeardown() {
  const prisma = new PrismaClient()
  try {
    const { count } = await prisma.user.deleteMany({
      where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
    })
    console.log(`E2E cleanup: deleted ${count} test user(s)`)
  } finally {
    await prisma.$disconnect()
  }
}
