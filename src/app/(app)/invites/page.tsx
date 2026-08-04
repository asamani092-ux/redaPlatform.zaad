"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type Row = {
  id: string;
  name: string;
  nationalId: string;
  mobile: string;
  dependentsCount?: number;
  statusLabel?: string;
  qrToken?: string | null;
};

/**
 * الدعوات = إنشاء رمز QR + إرساله واتساباً.
 * الطباعة = قائمة المدعوين فقط مع QR بهوية المنصة.
 * البطاقات: اسم + جوال + توسيع التفاصيل — O(n) عرضاً، O(1) لكل توسيع.
 */
export default function InvitesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  /** اختيار للدعوة | عرض المدعوين فقط (للطباعة) */
  const [view, setView] = useState<"pick" | "invited">("pick");

  async function load() {
    const res = await fetch(`/api/beneficiaries?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    if (res.ok) setRows(json.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invitedRows = useMemo(() => rows.filter((r) => !!r.qrToken), [rows]);
  const visibleRows = view === "invited" ? invitedRows : rows;

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function inviteAndSend() {
    if (!selectedIds.length) {
      setMsg("حدد مستفيدين أولاً");
      return;
    }
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryIds: selectedIds, sendWhatsApp: true }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(
      res.ok
        ? `تمت دعوة ${json.invited} مستفيد وإرسال رمز QR عبر واتساب`
        : json.error || "فشلت الدعوة",
    );
    if (res.ok) {
      setSelected({});
      load();
      setView("invited");
    }
  }

  function printInvited() {
    if (!invitedRows.length) {
      setMsg("لا يوجد مدعوون للطباعة بعد");
      return;
    }
    window.open("/api/invites/print", "_blank", "noopener,noreferrer");
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="الدعوات الجماعية"
        description="دعوة عبر واتساب مع QR — الطباعة للمستدعَين فقط بهوية المنصة"
        actions={
          <>
            {view === "pick" ? (
              <button
                className="btn-primary"
                type="button"
                disabled={busy || !selectedIds.length}
                onClick={inviteAndSend}
              >
                {busy ? "جاري الإرسال…" : `دعوة وإرسال QR واتساب (${selectedIds.length})`}
              </button>
            ) : null}
            <button
              className="btn-secondary"
              type="button"
              disabled={!invitedRows.length}
              onClick={printInvited}
            >
              طباعة قائمة المدعوين ({invitedRows.length})
            </button>
          </>
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <div className="toolbar">
          <input
            className="input-field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="تصفية بالاسم أو الهوية"
          />
          <button className="btn-secondary" type="button" onClick={load}>
            تحديث
          </button>
          <button
            type="button"
            className={view === "pick" ? "btn-primary" : "btn-secondary"}
            onClick={() => setView("pick")}
          >
            اختيار للدعوة
          </button>
          <button
            type="button"
            className={view === "invited" ? "btn-primary" : "btn-secondary"}
            onClick={() => setView("invited")}
          >
            المدعوون فقط ({invitedRows.length})
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="data-card-list__head">
          <h2 className="panel-title" style={{ margin: 0 }}>
            {view === "invited" ? "المدعوون (للطباعة)" : "المستفيدون"}
          </h2>
          {view === "pick" && visibleRows.length ? (
            <label className="data-card-list__select-all">
              <input
                type="checkbox"
                checked={
                  visibleRows.length > 0 && visibleRows.every((r) => selected[r.id])
                }
                onChange={(e) => {
                  const next: Record<string, boolean> = {};
                  if (e.target.checked) visibleRows.forEach((r) => (next[r.id] = true));
                  setSelected(next);
                }}
              />
              تحديد الكل
            </label>
          ) : null}
        </div>

        <div className="data-card-list">
          {visibleRows.map((r, idx) => {
            const open = !!expanded[r.id];
            return (
              <article
                key={r.id}
                className={`data-card ${open ? "is-open" : ""}`}
              >
                <div className="data-card__main">
                  {view === "pick" ? (
                    <label className="data-card__check">
                      <input
                        type="checkbox"
                        checked={!!selected[r.id]}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [r.id]: e.target.checked }))
                        }
                        aria-label={`اختيار ${r.name}`}
                      />
                    </label>
                  ) : (
                    <span className="data-card__index" aria-hidden>
                      {idx + 1}
                    </span>
                  )}

                  <div className="data-card__identity">
                    <strong className="data-card__name">{r.name}</strong>
                    <span className="data-card__mobile" dir="ltr">
                      {r.mobile}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary data-card__toggle"
                    aria-expanded={open}
                    onClick={() => toggleExpand(r.id)}
                  >
                    {open ? "إخفاء" : "عرض البيانات"}
                  </button>
                </div>

                <div
                  className="data-card__details"
                  hidden={!open}
                >
                  <div className="data-card__row">
                    <span className="data-card__label">الهوية</span>
                    <span className="data-card__value" dir="ltr">
                      {r.nationalId}
                    </span>
                  </div>
                  <div className="data-card__row">
                    <span className="data-card__label">عدد التابعين</span>
                    <span className="data-card__value">{r.dependentsCount ?? 0}</span>
                  </div>
                  <div className="data-card__row">
                    <span className="data-card__label">الحالة</span>
                    <span className="badge badge-muted">{r.statusLabel ?? "—"}</span>
                  </div>
                  <div className="data-card__row data-card__row--qr">
                    <span className="data-card__label">QR</span>
                    {r.qrToken ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="data-card__qr"
                        src={`/api/qr/${r.qrToken}`}
                        alt={`رمز QR لـ ${r.name}`}
                        width={88}
                        height={88}
                      />
                    ) : (
                      <span className="data-card__value">—</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {!visibleRows.length ? (
            <p className="empty">
              {view === "invited" ? "لا مدعوون بعد" : "لا توجد بيانات"}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
