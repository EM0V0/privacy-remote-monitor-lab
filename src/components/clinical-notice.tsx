/**
 * Scheme A regulatory-facing banners (monitoring / transport posture).
 */

export type ClinicalNoticeVariant = "intendedUse" | "transport";

const COPY: Record<
  ClinicalNoticeVariant,
  { title: string; body: string }
> = {
  intendedUse: {
    title: "Monitoring & trends only",
    body:
      "This application supports remote monitoring and visualization of recorded signals. " +
      "It is not intended as a sole basis for diagnosis or treatment. " +
      "Seek emergency care for urgent symptoms; interpret trends with a qualified clinician.",
  },
  transport: {
    title: "Secure connectivity",
    body:
      "HTTPS/TLS is enforced between browser and API as configured for your deployment. " +
      "Session cookies are HttpOnly; upgrade to full OIDC + rotating tokens for regulated SaaMD deployments.",
  },
};

export function ClinicalNotice({
  variant = "intendedUse",
  compact = false,
}: {
  variant?: ClinicalNoticeVariant;
  compact?: boolean;
}) {
  const { title, body } = COPY[variant];
  return (
    <aside
      role="note"
      className={
        compact
          ? "rounded-lg border border-teal-700/25 bg-teal-700/5 px-3 py-2.5 text-sm"
          : "rounded-xl border border-teal-700/25 bg-teal-700/5 px-4 py-3"
      }
    >
      <div className="flex gap-3">
        <span className="select-none text-teal-700" aria-hidden>
          ℹ
        </span>
        <div>
          <p className="font-semibold text-teal-900">{title}</p>
          <p
            className={
              compact
                ? "mt-1 text-xs leading-relaxed text-slate-600"
                : "mt-1 text-sm leading-relaxed text-slate-600"
            }
          >
            {body}
          </p>
        </div>
      </div>
    </aside>
  );
}
