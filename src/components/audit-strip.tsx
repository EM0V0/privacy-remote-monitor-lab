import type { AuditEvent, User } from "@prisma/client";

export type AuditRow = AuditEvent & {
  actor: Pick<User, "email"> | null;
};

/**
 * Read-only strip for clinician demos — surfaces append-only audit semantics without implying certification.
 */
export function AuditStrip({ events }: { events: AuditRow[] }) {
  if (events.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No audit events recorded yet.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Recent accountability events
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Append-only rows sealed with SHA-256 hash chains over canonical JSON payloads — verify programmatically via{" "}
        <span className="font-mono">verifyAuditChainIntegrity()</span> when integrating SIEM / WORM exports.
      </p>
      <ul className="mt-3 divide-y divide-slate-100 text-sm">
        {events.map((e) => (
          <li key={e.id} className="flex flex-wrap gap-x-3 gap-y-1 py-2 text-slate-700">
            <time className="shrink-0 font-mono text-xs text-slate-500">
              {e.createdAt.toISOString()}
            </time>
            <span className="font-medium text-slate-900">{e.eventType}</span>
            <span className="text-slate-600">
              {e.actor?.email ?? e.subject ?? "—"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
