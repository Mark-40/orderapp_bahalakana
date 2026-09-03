import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Burns roughly the same time as a real bcrypt comparison. Called when the
 * email does not exist so that response timing does not reveal which admin
 * addresses are registered.
 */
export async function fakeVerify(): Promise<void> {
  await bcrypt.compare(
    'timing-equalizer',
    '$2b$12$BGsLxNxIDeBDyW9JYjlRRe0nqkkJq14MC7kjbxHCjt9MHrI22ztc2',
  )
}
