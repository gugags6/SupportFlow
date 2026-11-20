/**
 * SupportFlow seed - FICTIONAL EXAMPLE DATA ONLY.
 *
 * Idempotent: every seed ticket has a fixed UUID. Tickets that already exist
 * (including soft-deleted ones) are skipped, so running the seed repeatedly
 * never creates duplicates and never consumes extra ticket numbers.
 */
import { PrismaClient, TicketPriority } from '@prisma/client';

interface SeedTicket {
  id: string;
  title: string;
  description: string;
  priority: TicketPriority;
}

const SEED_TICKETS: readonly SeedTicket[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Exemplo 1',
    description: 'Descrição fictícia do chamado Exemplo 1.',
    priority: TicketPriority.LOW,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Exemplo 2',
    description: 'Descrição fictícia do chamado Exemplo 2.',
    priority: TicketPriority.MEDIUM,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    title: 'Exemplo 3',
    description: 'Descrição fictícia do chamado Exemplo 3.',
    priority: TicketPriority.HIGH,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    title: 'Exemplo 4',
    description: 'Descrição fictícia do chamado Exemplo 4.',
    priority: TicketPriority.CRITICAL,
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    title: 'Exemplo 5',
    description: 'Descrição fictícia do chamado Exemplo 5.',
    priority: TicketPriority.MEDIUM,
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.ticket.findMany({
      where: { id: { in: SEED_TICKETS.map((t) => t.id) } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((t) => t.id));
    const missing = SEED_TICKETS.filter((t) => !existingIds.has(t.id));

    // Sequential inserts keep ticket numbers in the same order as the seed list.
    for (const ticket of missing) {
      const created = await prisma.ticket.create({ data: ticket });
      console.log(`[seed] created ${created.ticketNumber} - ${created.title}`);
    }

    console.log(
      `[seed] done: ${missing.length} created, ${existingIds.size} already present (total ${SEED_TICKETS.length}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
