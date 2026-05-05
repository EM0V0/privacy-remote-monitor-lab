import { prisma } from "@/lib/prisma";

export type AuditWriteInput = {
  eventType: string;
  actorId?: string | null;
  subject?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Persists an append-only audit row for accountability demos.
 */
export async function writeAudit(input: AuditWriteInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      eventType: input.eventType,
      actorId: input.actorId ?? undefined,
      subject: input.subject ?? undefined,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });
}
