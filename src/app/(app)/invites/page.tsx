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

function initialOf(name: string): string {
  const t = name.trim();
  return t ? t[0]! : "؟";
}

/**
 * الدعوات: صف يعرض البيانات الأساسية دائماً، وQR عند التوسيع.
 * Time: O(n) عرضاً، O(1) لكل توسيع.
 */
export default function InvitesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
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

      <section className="panel invite-panel">
        <div className="invite-list__head">
          <div>
            <h2 className="panel-title" style={{ margin: 0 }}>
              {view === "invited" ? "المدعوون (للطباعة)" : "المستفيدون"}
            </h2>
            <p className="invite-list__hint">
              {visibleRows.length} سجل — البيانات الأساسية ظاهرة، والضغط يظهر رمز QR
            </p>
          </div>
          {view === "pick" && visibleRows.length ? (
            <label className="invite-list__select-all">
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

        <ul className="invite-list">
          {visibleRows.map((r, idx) => {
            const open = !!expanded[r.id];
            const checked = !!selected[r.id];
            return (
              <li
                key={r.id}
                className={`invite-row ${open ? "is-open" : ""} ${checked ? "is-checked" : ""}`}
              >
                <div className="invite-row__bar">
                  {view === "pick" ? (
                    <label
                      className="invite-row__check"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [r.id]: e.target.checked }))
                        }
                        aria-label={`اختيار ${r.name}`}
                      />
                    </label>
                  ) : (
                    <span className="invite-row__num">{idx + 1}</span>
                  )}

                  <button
                    type="button"
                    className="invite-row__hit"
                    aria-expanded={open}
                    onClick={() => toggleExpand(r.id)}
                  >
                    <span className="invite-row__avatar" aria-hidden>
                      {initialOf(r.name)}
                    </span>

                    <span className="invite-row__body">
                      <span className="invite-row__top">
                        <span className="invite-row__name">{r.name}</span>
                        {r.statusLabel ? (
                          <span className="invite-row__status">{r.statusLabel}</span>
                        ) : null}
                      </span>

                      <span className="invite-row__meta" aria-label="بيانات المستفيد">
                        <span className="invite-row__meta-item">
                          <span className="invite-row__meta-k">الجوال</span>
                          <span className="invite-row__meta-v" dir="ltr">
                            {r.mobile}
                          </span>
                        </span>
                        <span className="invite-row__meta-item">
                          <span className="invite-row__meta-k">الهوية</span>
                          <span className="invite-row__meta-v" dir="ltr">
                            {r.nationalId}
                          </span>
                        </span>
                        <span className="invite-row__meta-item">
                          <span className="invite-row__meta-k">التابعون</span>
                          <span className="invite-row__meta-v">{r.dependentsCount ?? 0}</span>
                        </span>
                      </span>
                    </span>

                    <span className="invite-row__action">
                      {open ? "إخفاء QR" : "عرض QR"}
                      <span className="invite-row__chevron" aria-hidden />
                    </span>
                  </button>
                </div>

                {open ? (
                  <div className="invite-row__panel">
                    <div className="invite-row__qr-box">
                      {r.qrToken ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/qr/${r.qrToken}`}
                          alt={`رمز QR لـ ${r.name}`}
                          width={112}
                          height={112}
                        />
                      ) : (
                        <span className="invite-row__qr-empty">لا يوجد رمز QR بعد — أرسل الدعوة أولاً</span>
                      )}
                    </div>
                    <p className="invite-row__qr-note">
                      {r.qrToken
                        ? "رمز الدعوة جاهز للمسح أو الطباعة من قائمة المدعوين"
                        : "بعد الدعوة عبر واتساب سيظهر الرمز هنا"}
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {!visibleRows.length ? (
          <p className="empty">
            {view === "invited" ? "لا مدعوون بعد" : "لا توجد بيانات"}
          </p>
        ) : null}
      </section>
    </div>
  );
}
