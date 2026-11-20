import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, Ticket, TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { TicketsService } from './tickets.service';

const TICKET_ID = '00000000-0000-4000-8000-0000000000aa';

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: TICKET_ID,
    ticketNumber: 'TCK-000001',
    title: 'Exemplo 1',
    description: 'Descrição fictícia do chamado Exemplo 1.',
    status: TicketStatus.OPEN,
    priority: TicketPriority.MEDIUM,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function makeQuery(overrides: Partial<ListTicketsQueryDto> = {}): ListTicketsQueryDto {
  return Object.assign(new ListTicketsQueryDto(), overrides);
}

const notFoundError = () =>
  new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
    code: 'P2025',
    clientVersion: 'test',
  });

describe('TicketsService', () => {
  let service: TicketsService;
  const prisma = {
    ticket: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [TicketsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(TicketsService);
  });

  describe('create', () => {
    it('creates a ticket with default status OPEN and the given priority', async () => {
      const created = makeTicket({ priority: TicketPriority.HIGH });
      prisma.ticket.create.mockResolvedValue(created);

      const result = await service.create({
        title: 'Exemplo 1',
        description: 'Descrição fictícia do chamado Exemplo 1.',
        priority: TicketPriority.HIGH,
      });

      expect(result).toBe(created);
      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: {
          title: 'Exemplo 1',
          description: 'Descrição fictícia do chamado Exemplo 1.',
          priority: TicketPriority.HIGH,
          status: TicketStatus.OPEN,
        },
      });
    });

    it('defaults priority to MEDIUM and never sends id or ticketNumber (DB-generated)', async () => {
      prisma.ticket.create.mockResolvedValue(makeTicket());

      await service.create({ title: 'Exemplo 2', description: 'Descrição fictícia.' });

      const { data } = prisma.ticket.create.mock.calls[0][0];
      expect(data.priority).toBe(TicketPriority.MEDIUM);
      expect(data).not.toHaveProperty('id');
      expect(data).not.toHaveProperty('ticketNumber');
    });
  });

  describe('findAll', () => {
    it('excludes soft-deleted tickets and returns pagination metadata', async () => {
      const tickets = [makeTicket()];
      prisma.ticket.findMany.mockResolvedValue(tickets);
      prisma.ticket.count.mockResolvedValue(21);

      const result = await service.findAll(makeQuery({ page: 3, limit: 10 }));

      expect(result).toEqual({
        data: tickets,
        meta: { page: 3, limit: 10, total: 21, totalPages: 3 },
      });
      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 20,
        take: 10,
      });
      expect(prisma.ticket.count).toHaveBeenCalledWith({ where: { deletedAt: null } });
    });

    it('applies status, priority, search filters and ascending order', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      const result = await service.findAll(
        makeQuery({
          status: TicketStatus.OPEN,
          priority: TicketPriority.HIGH,
          search: 'Exemplo',
          order: 'asc',
        }),
      );

      const expectedWhere = {
        deletedAt: null,
        status: TicketStatus.OPEN,
        priority: TicketPriority.HIGH,
        title: { contains: 'Exemplo', mode: 'insensitive' },
      };
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: 0,
          take: 10,
        }),
      );
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    });
  });

  describe('findOne', () => {
    it('returns a non-deleted ticket', async () => {
      const ticket = makeTicket();
      prisma.ticket.findFirst.mockResolvedValue(ticket);

      await expect(service.findOne(TICKET_ID)).resolves.toBe(ticket);
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: TICKET_ID, deletedAt: null },
      });
    });

    it('throws NotFoundException when the ticket does not exist or is deleted', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TICKET_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates title and description of an active ticket', async () => {
      const updated = makeTicket({ title: 'Exemplo 1 (editado)' });
      prisma.ticket.update.mockResolvedValue(updated);

      await expect(service.update(TICKET_ID, { title: 'Exemplo 1 (editado)' })).resolves.toBe(
        updated,
      );
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: TICKET_ID, deletedAt: null },
        data: { title: 'Exemplo 1 (editado)', description: undefined },
      });
    });

    it('rejects an empty update', () => {
      expect(() => service.update(TICKET_ID, {})).toThrow(BadRequestException);
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it('maps a missing/deleted ticket to NotFoundException', async () => {
      prisma.ticket.update.mockRejectedValue(notFoundError());
      await expect(service.update(TICKET_ID, { title: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rethrows unexpected errors', async () => {
      const boom = new Error('connection lost');
      prisma.ticket.update.mockRejectedValue(boom);
      await expect(service.update(TICKET_ID, { title: 'X' })).rejects.toBe(boom);
    });
  });

  describe('updateStatus', () => {
    it('updates the status of an active ticket', async () => {
      prisma.ticket.update.mockResolvedValue(makeTicket({ status: TicketStatus.IN_PROGRESS }));

      const result = await service.updateStatus(TICKET_ID, TicketStatus.IN_PROGRESS);

      expect(result.status).toBe(TicketStatus.IN_PROGRESS);
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: TICKET_ID, deletedAt: null },
        data: { status: TicketStatus.IN_PROGRESS },
      });
    });

    it('throws NotFoundException for a missing ticket', async () => {
      prisma.ticket.update.mockRejectedValue(notFoundError());
      await expect(service.updateStatus(TICKET_ID, TicketStatus.CLOSED)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updatePriority', () => {
    it('updates the priority of an active ticket', async () => {
      prisma.ticket.update.mockResolvedValue(makeTicket({ priority: TicketPriority.CRITICAL }));

      const result = await service.updatePriority(TICKET_ID, TicketPriority.CRITICAL);

      expect(result.priority).toBe(TicketPriority.CRITICAL);
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: TICKET_ID, deletedAt: null },
        data: { priority: TicketPriority.CRITICAL },
      });
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting deletedAt (no physical delete)', async () => {
      prisma.ticket.update.mockResolvedValue(makeTicket({ deletedAt: new Date() }));

      await expect(service.remove(TICKET_ID)).resolves.toBeUndefined();

      const call = prisma.ticket.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: TICKET_ID, deletedAt: null });
      expect(call.data.deletedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when already deleted', async () => {
      prisma.ticket.update.mockRejectedValue(notFoundError());
      await expect(service.remove(TICKET_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
