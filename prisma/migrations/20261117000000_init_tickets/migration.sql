-- SupportFlow - initial migration: tickets

-- Sequence + function used to generate concurrency-safe, human-readable
-- ticket numbers (TCK-000001, TCK-000002, ...). nextval() is atomic and never
-- returns the same value twice, even under concurrent transactions.
CREATE SEQUENCE "ticket_number_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Pads to at least 6 digits; never truncates (TCK-1000000 after TCK-999999).
CREATE FUNCTION generate_ticket_number() RETURNS TEXT
LANGUAGE sql VOLATILE AS $$
  SELECT 'TCK-' || CASE
    WHEN n < 1000000 THEN lpad(n::text, 6, '0')
    ELSE n::text
  END
  FROM (SELECT nextval('ticket_number_seq') AS n) AS s;
$$;

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_number" VARCHAR(20) NOT NULL DEFAULT generate_ticket_number(),
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_priority_idx" ON "tickets"("priority");

-- CreateIndex
CREATE INDEX "tickets_created_at_idx" ON "tickets"("created_at");

ALTER SEQUENCE "ticket_number_seq" OWNED BY "tickets"."ticket_number";
