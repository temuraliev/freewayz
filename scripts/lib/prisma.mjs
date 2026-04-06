/**
 * Shared Prisma client for scripts and bots.
 * Reuses a single PrismaClient instance per process.
 */
import prismaPkg from '@prisma/client';

const { PrismaClient } = prismaPkg;

let _prisma;

export function getPrisma() {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}
