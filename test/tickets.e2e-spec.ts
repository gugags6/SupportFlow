import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Ticket } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';

const BASE = '/api/v1/tickets';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000ffff';
const TICKET_NUMBER_FORMAT = /^TCK-\d{6,}$/;

interface Paginated {
  data: Ticket[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface ErrorBody {
  statusCode: number;
  message: string;
  errors: string[];
  timestamp: string;
  path: string;
}

describe('Tickets API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());

  const createTicket = async (body: Record<string, unknown> = {}): Promise<Ticket> => {
    const res = await http()
      .post(BASE)
      .send({
        title: 'Exemplo 1',
        description: 'Descrição fictícia do chamado Exemplo 1.',
        ...body,
      })
      .expect(201);
    return res.body as Ticket;
  };

  const expectErrorShape = (body: ErrorBody, statusCode: number) => {
    expect(body).toEqual({
      statusCode,
      message: expect.any(String),
      errors: expect.any(Array),
      timestamp: expect.any(String),
      path: expect.any(String),
    });
    expect(JSON.stringify(body)).not.toMatch(/prisma|stack|at .*\.ts/i);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // RESTART IDENTITY also resets ticket_number_seq (owned by tickets.ticket_number).
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "tickets" RESTART IDENTITY');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /tickets', () => {
    it('creates a ticket with generated id, ticket number and defaults', async () => {
      const res = await http()
        .post(BASE)
        .send({ title: 'Exemplo 1', description: 'Descrição fictícia do chamado Exemplo 1.' })
        .expect(201);

      const body = res.body as Ticket;
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.ticketNumber).toBe('TCK-000001');
      expect(body.status).toBe('OPEN');
      expect(body.priority).toBe('MEDIUM');
      expect(body.deletedAt).toBeNull();
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();

      const persisted = await prisma.ticket.findUnique({ where: { id: body.id } });
      expect(persisted?.title).toBe('Exemplo 1');
    });

    it('accepts an explicit priority and generates sequential ticket numbers', async () => {
      const first = await createTicket();
      const second = await createTicket({ title: 'Exemplo 2', priority: 'HIGH' });

      expect(first.ticketNumber).toBe('TCK-000001');
      expect(second.ticketNumber).toBe('TCK-000002');
      expect(second.priority).toBe('HIGH');
    });

    it('rejects a missing title', async () => {
      const res = await http().post(BASE).send({ description: 'Descrição fictícia.' }).expect(400);
      expectErrorShape(res.body, 400);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors).toContain('title should not be empty');
    });

    it('rejects a missing description', async () => {
      const res = await http().post(BASE).send({ title: 'Exemplo 1' }).expect(400);
      expectErrorShape(res.body, 400);
      expect(res.body.errors).toContain('description should not be empty');
    });

    it('rejects empty / whitespace-only title and description', async () => {
      const res = await http().post(BASE).send({ title: '   ', description: '' }).expect(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining(['title should not be empty', 'description should not be empty']),
      );
    });

    it('rejects an invalid priority', async () => {
      const res = await http()
        .post(BASE)
        .send({ title: 'Exemplo 1', description: 'Descrição fictícia.', priority: 'URGENT' })
        .expect(400);
      expect(res.body.errors[0]).toMatch(/priority must be one of the following values/);
    });

    it('rejects client-supplied immutable fields', async () => {
      const res = await http()
        .post(BASE)
        .send({
          title: 'Exemplo 1',
          description: 'Descrição fictícia.',
          ticketNumber: 'TCK-999999',
        })
        .expect(400);
      expect(res.body.errors).toContain('property ticketNumber should not exist');
    });
  });

  describe('duplicate ticket number prevention', () => {
    it('generates unique, gapless ticket numbers for concurrent requests', async () => {
      const total = 30;
      const responses = await Promise.all(
        Array.from({ length: total }, (_, i) =>
          http()
            .post(BASE)
            .send({ title: `Exemplo ${i + 1}`, description: `Descrição fictícia ${i + 1}.` }),
        ),
      );

      responses.forEach((res) => expect(res.status).toBe(201));
      const numbers = responses.map((res) => (res.body as Ticket).ticketNumber);
      numbers.forEach((n) => expect(n).toMatch(TICKET_NUMBER_FORMAT));
      expect(new Set(numbers).size).toBe(total);

      const expected = Array.from(
        { length: total },
        (_, i) => `TCK-${String(i + 1).padStart(6, '0')}`,
      );
      expect([...numbers].sort()).toEqual(expected);
    });

    it('enforces uniqueness at the database level', async () => {
      const ticket = await createTicket();
      await expect(
        prisma.ticket.create({
          data: {
            title: 'Exemplo 2',
            description: 'Descrição fictícia.',
            ticketNumber: ticket.ticketNumber,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('GET /tickets', () => {
    beforeEach(async () => {
      // Sequential creation → strictly increasing createdAt.
      await createTicket({ title: 'Exemplo 1', priority: 'LOW' });
      await createTicket({ title: 'Exemplo 2', priority: 'MEDIUM' });
      await createTicket({ title: 'Exemplo 3', priority: 'HIGH' });
      await createTicket({ title: 'Exemplo 4', priority: 'CRITICAL' });
      await createTicket({ title: 'Outro chamado 5', priority: 'HIGH' });
    });

    it('lists tickets with default pagination, newest first', async () => {
      const res = await http().get(BASE).expect(200);
      const body = res.body as Paginated;

      expect(body.meta).toEqual({ page: 1, limit: 10, total: 5, totalPages: 1 });
      expect(body.data).toHaveLength(5);
      expect(body.data.map((t) => t.ticketNumber)).toEqual([
        'TCK-000005',
        'TCK-000004',
        'TCK-000003',
        'TCK-000002',
        'TCK-000001',
      ]);
    });

    it('sorts by creation date ascending', async () => {
      const res = await http().get(BASE).query({ order: 'asc' }).expect(200);
      expect((res.body as Paginated).data[0].ticketNumber).toBe('TCK-000001');
    });

    it('paginates results', async () => {
      const page1 = (await http().get(BASE).query({ page: 1, limit: 2 }).expect(200))
        .body as Paginated;
      const page3 = (await http().get(BASE).query({ page: 3, limit: 2 }).expect(200))
        .body as Paginated;
      const page4 = (await http().get(BASE).query({ page: 4, limit: 2 }).expect(200))
        .body as Paginated;

      expect(page1.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
      expect(page1.data.map((t) => t.ticketNumber)).toEqual(['TCK-000005', 'TCK-000004']);
      expect(page3.data.map((t) => t.ticketNumber)).toEqual(['TCK-000001']);
      expect(page4.data).toEqual([]);
    });

    it('filters by priority', async () => {
      const res = await http().get(BASE).query({ priority: 'HIGH' }).expect(200);
      const body = res.body as Paginated;
      expect(body.meta.total).toBe(2);
      body.data.forEach((t) => expect(t.priority).toBe('HIGH'));
    });

    it('filters by status and priority combined', async () => {
      const target = (await http().get(BASE).query({ priority: 'HIGH', order: 'asc' }))
        .body as Paginated;
      await http()
        .patch(`${BASE}/${target.data[0].id}/status`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      const res = await http()
        .get(BASE)
        .query({ status: 'IN_PROGRESS', priority: 'HIGH' })
        .expect(200);
      const body = res.body as Paginated;
      expect(body.meta.total).toBe(1);
      expect(body.data[0].id).toBe(target.data[0].id);

      const open = (await http().get(BASE).query({ status: 'OPEN' }).expect(200)).body as Paginated;
      expect(open.meta.total).toBe(4);
    });

    it('searches by title (case-insensitive, partial)', async () => {
      const res = await http().get(BASE).query({ search: 'exemplo' }).expect(200);
      const body = res.body as Paginated;
      expect(body.meta.total).toBe(4);
      body.data.forEach((t) => expect(t.title).toMatch(/Exemplo/));
    });

    it.each([
      [{ page: 0 }],
      [{ page: 'abc' }],
      [{ page: 1.5 }],
      [{ limit: 0 }],
      [{ limit: 101 }],
      [{ status: 'UNKNOWN' }],
      [{ priority: 'URGENT' }],
      [{ order: 'sideways' }],
    ])('rejects invalid query %p', async (query) => {
      const res = await http().get(BASE).query(query).expect(400);
      expectErrorShape(res.body, 400);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('GET /tickets/:id', () => {
    it('retrieves a ticket by id', async () => {
      const ticket = await createTicket();
      const res = await http().get(`${BASE}/${ticket.id}`).expect(200);
      expect(res.body).toEqual(ticket);
    });

    it('returns 400 for an invalid UUID', async () => {
      const res = await http().get(`${BASE}/not-a-uuid`).expect(400);
      expectErrorShape(res.body, 400);
      expect(res.body.errors).toEqual(['id must be a valid UUID']);
    });

    it('returns 404 when the ticket does not exist', async () => {
      const res = await http().get(`${BASE}/${UNKNOWN_ID}`).expect(404);
      expectErrorShape(res.body, 404);
      expect(res.body.message).toBe(`Ticket with id ${UNKNOWN_ID} not found`);
    });
  });

  describe('PATCH /tickets/:id', () => {
    it('updates title and description', async () => {
      const ticket = await createTicket();
      const res = await http()
        .patch(`${BASE}/${ticket.id}`)
        .send({ title: 'Exemplo 1 (editado)', description: 'Nova descrição fictícia.' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: 'Exemplo 1 (editado)',
        description: 'Nova descrição fictícia.',
        status: 'OPEN',
        priority: 'MEDIUM',
      });
      expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(ticket.updatedAt).getTime(),
      );
    });

    it('supports partial updates', async () => {
      const ticket = await createTicket();
      const res = await http()
        .patch(`${BASE}/${ticket.id}`)
        .send({ title: 'Só título' })
        .expect(200);
      expect(res.body.title).toBe('Só título');
      expect(res.body.description).toBe(ticket.description);
    });

    it.each([
      ['status', 'CLOSED'],
      ['priority', 'HIGH'],
      ['ticketNumber', 'TCK-000999'],
      ['id', UNKNOWN_ID],
      ['deletedAt', null],
    ])('rejects updating immutable/other field "%s"', async (field, value) => {
      const ticket = await createTicket();
      const res = await http()
        .patch(`${BASE}/${ticket.id}`)
        .send({ title: 'Exemplo', [field]: value })
        .expect(400);
      expect(res.body.errors).toContain(`property ${field} should not exist`);
    });

    it('rejects an empty title and an empty body', async () => {
      const ticket = await createTicket();
      await http().patch(`${BASE}/${ticket.id}`).send({ title: '' }).expect(400);
      const res = await http().patch(`${BASE}/${ticket.id}`).send({}).expect(400);
      expect(res.body.errors).toEqual(['at least one of title or description must be provided']);
    });

    it('returns 404 for an unknown ticket', async () => {
      await http().patch(`${BASE}/${UNKNOWN_ID}`).send({ title: 'Exemplo' }).expect(404);
    });
  });

  describe('PATCH /tickets/:id/status', () => {
    it('updates the status', async () => {
      const ticket = await createTicket();
      const res = await http()
        .patch(`${BASE}/${ticket.id}/status`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
      expect(res.body.status).toBe('IN_PROGRESS');
    });

    it('rejects an invalid or missing status', async () => {
      const ticket = await createTicket();
      const invalid = await http()
        .patch(`${BASE}/${ticket.id}/status`)
        .send({ status: 'DONE' })
        .expect(400);
      expect(invalid.body.errors[0]).toMatch(/status must be one of the following values/);
      await http().patch(`${BASE}/${ticket.id}/status`).send({}).expect(400);
    });

    it('returns 404 for an unknown ticket', async () => {
      await http().patch(`${BASE}/${UNKNOWN_ID}/status`).send({ status: 'CLOSED' }).expect(404);
    });
  });

  describe('PATCH /tickets/:id/priority', () => {
    it('updates the priority', async () => {
      const ticket = await createTicket();
      const res = await http()
        .patch(`${BASE}/${ticket.id}/priority`)
        .send({ priority: 'CRITICAL' })
        .expect(200);
      expect(res.body.priority).toBe('CRITICAL');
    });

    it('rejects an invalid priority', async () => {
      const ticket = await createTicket();
      const res = await http()
        .patch(`${BASE}/${ticket.id}/priority`)
        .send({ priority: 'low' })
        .expect(400);
      expect(res.body.errors[0]).toMatch(/priority must be one of the following values/);
    });
  });

  describe('DELETE /tickets/:id (soft delete)', () => {
    it('soft-deletes the ticket without removing the record', async () => {
      const ticket = await createTicket();
      const res = await http().delete(`${BASE}/${ticket.id}`).expect(204);
      expect(res.body).toEqual({});

      const row = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(row).not.toBeNull();
      expect(row?.deletedAt).toBeInstanceOf(Date);
    });

    it('excludes deleted tickets from retrieval, listing, search and updates', async () => {
      const kept = await createTicket({ title: 'Exemplo mantido' });
      const deleted = await createTicket({ title: 'Exemplo removido' });
      await http().delete(`${BASE}/${deleted.id}`).expect(204);

      await http().get(`${BASE}/${deleted.id}`).expect(404);
      await http().patch(`${BASE}/${deleted.id}`).send({ title: 'X' }).expect(404);
      await http().patch(`${BASE}/${deleted.id}/status`).send({ status: 'CLOSED' }).expect(404);
      await http().patch(`${BASE}/${deleted.id}/priority`).send({ priority: 'LOW' }).expect(404);
      await http().delete(`${BASE}/${deleted.id}`).expect(404);

      const list = (await http().get(BASE).expect(200)).body as Paginated;
      expect(list.meta.total).toBe(1);
      expect(list.data.map((t) => t.id)).toEqual([kept.id]);

      const search = (await http().get(BASE).query({ search: 'removido' }).expect(200))
        .body as Paginated;
      expect(search.meta.total).toBe(0);
    });

    it('returns 400 for an invalid UUID and 404 for an unknown ticket', async () => {
      await http().delete(`${BASE}/123`).expect(400);
      await http().delete(`${BASE}/${UNKNOWN_ID}`).expect(404);
    });
  });

  describe('Swagger', () => {
    it('serves the OpenAPI document at /api/docs', async () => {
      const res = await http().get('/api/docs-json').expect(200);
      const paths = Object.keys((res.body as { paths: Record<string, unknown> }).paths);
      expect(paths).toEqual(
        expect.arrayContaining([
          '/api/v1/tickets',
          '/api/v1/tickets/{id}',
          '/api/v1/tickets/{id}/status',
          '/api/v1/tickets/{id}/priority',
        ]),
      );
    });
  });
});
