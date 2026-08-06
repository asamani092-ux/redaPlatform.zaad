import type { ShareRow, TopDispensedItem } from "@/lib/report-metrics";

/** عقد بيانات منشئ العرض التقديمي (نظام التصميم — window.ZAD_REPORT) */
export type ZadPresentationReport = {
  title: string;
  period: string;
  summary: Array<{ text: string; rows: [string, string][]; note?: string }>;
  kpis: Array<{
    label: string;
    value: string;
    delta?: string;
    rows: [string, string][];
    note?: string;
  }>;
  dist: Array<{
    label: string;
    pct: number;
    color?: string;
    rows: [string, string][];
    note?: string;
  }>;
  funnel: Array<{
    stage: string;
    count: number;
    pct: number;
    rows: [string, string][];
    note?: string;
  }>;
  progress: Array<{
    label: string;
    pct: number;
    rows: [string, string][];
    note?: string;
  }>;
  programs: Array<{
    prog: string;
    total: string;
    done: string;
    pct: string;
    rows: [string, string][];
    note?: string;
  }>;
  timeline: Array<{
    title: string;
    time: string;
    rows: [string, string][];
    note?: string;
  }>;
  evidence: Array<{
    src: string;
    caption: string;
    tag: string;
    note?: string;
  }>;
  disb: Array<{
    label: string;
    amount: string;
    rows: [string, string][];
    note?: string;
  }>;
};

export type PresentationSummaryInput = {
  exhibitionName: string;
  exhibitionActive: boolean;
  totalBeneficiaries: number;
  invited: number;
  attended: number;
  received: number;
  exceptionAttendance?: number;
  overrideDispenses?: number;
  piecesDispensed: number;
  beneficiaryFamilies?: number;
  avgHouseholdSize?: number;
  byGenderShares?: ShareRow[];
  byCityShares?: ShareRow[];
  byNeighborhoodShares?: ShareRow[];
  byAssociationShares?: ShareRow[];
  byHouseholdSizeShares?: ShareRow[];
  byGender?: Record<string, number>;
  byCity?: Record<string, number>;
  byAssociation?: Record<string, number>;
  byFamilySize?: Record<string, number>;
  topItems?: TopDispensedItem[];
};

const DIST_COLORS = ["#951740", "#e9b221", "#3f8f5f", "#c0563a", "#4a6fa5"];

/** تحويل أرقام غربية إلى عربية للعرض — Time/Space: O(len) */
export function toArabicDigits(n: string | number): string {
  return String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
}

function pctOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function sharesOrRecord(
  shares: ShareRow[] | undefined,
  record: Record<string, number> | undefined,
): ShareRow[] {
  if (shares?.length) return shares;
  if (!record) return [];
  const sum = Object.values(record).reduce((s, n) => s + n, 0);
  return Object.entries(record)
    .map(([key, count]) => ({
      key,
      count,
      percent: sum > 0 ? Math.round((count / sum) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "ar"));
}

function itemLabel(attributes: Record<string, unknown>): string {
  const parts = Object.entries(attributes ?? {}).map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length ? parts.join(" · ") : "صنف";
}

/**
 * تحويل ملخص تقارير المنصة إلى عقد منشئ العرض.
 * Time: O(k) حيث k = عدد صفوف التوزيع/الأصناف؛ Space: O(k).
 */
export function buildZadPresentationReport(
  s: PresentationSummaryInput,
): ZadPresentationReport {
  const families = s.beneficiaryFamilies ?? s.totalBeneficiaries;
  const gender = sharesOrRecord(s.byGenderShares, s.byGender);
  const city = sharesOrRecord(s.byCityShares, s.byCity);
  const assoc = sharesOrRecord(s.byAssociationShares, s.byAssociation);
  const household = sharesOrRecord(s.byHouseholdSizeShares, s.byFamilySize);
  const top = s.topItems ?? [];

  const attendPct = pctOf(s.attended, Math.max(s.invited, 1));
  const receiveFromAttendPct = pctOf(s.received, Math.max(s.attended, 1));
  const receiveFromTotalPct = pctOf(s.received, Math.max(s.totalBeneficiaries, 1));

  const ar = (n: string | number) => toArabicDigits(n);

  return {
    title: `تقرير معرض ${s.exhibitionName}`,
    period: s.exhibitionActive ? "المعرض النشط — لقطة تشغيل" : `معرض: ${s.exhibitionName}`,
    summary: [
      {
        text: `إجمالي المستفيدين المسجّلين ${ar(s.totalBeneficiaries)} يمثلون ${ar(families)} أسرة بمتوسط حجم ${ar(s.avgHouseholdSize ?? "—")}.`,
        rows: [
          ["المستفيدون", ar(s.totalBeneficiaries)],
          ["الأسر", ar(families)],
          ["متوسط حجم الأسرة", ar(s.avgHouseholdSize ?? "—")],
        ],
        note: "حجم الأسرة = المستفيد + التابعون.",
      },
      {
        text: `دُعي ${ar(s.invited)} وحضر ${ar(s.attended)} واستلم ${ar(s.received)} مستفيداً.`,
        rows: [
          ["المدعوون", ar(s.invited)],
          ["الحضور", ar(s.attended)],
          ["المستلمون", ar(s.received)],
        ],
        note: "مسار الدعوة → الحضور → الاستلام.",
      },
      {
        text: `صُرف إجمالي ${ar(s.piecesDispensed)} قطعة خلال المعرض.`,
        rows: [
          ["القطع المصروفة", ar(s.piecesDispensed)],
          ["حضور استثنائي", ar(s.exceptionAttendance ?? 0)],
          ["صرف استثنائي", ar(s.overrideDispenses ?? 0)],
        ],
        note: "يشمل الصرف العادي والاستثناءات المعتمدة.",
      },
      ...(city[0]
        ? [
            {
              text: `أعلى مدينة من حيث المستفيدين: ${city[0].key} بنسبة ${ar(city[0].percent)}٪.`,
              rows: city
                .slice(0, 5)
                .map((r): [string, string] => [r.key, `${ar(r.count)} (${ar(r.percent)}٪)`]),
              note: "توزيع المستفيدين حسب المدينة.",
            },
          ]
        : []),
      ...(household[0]
        ? [
            {
              text: `أكثر أحجام الأسر شيوعاً: ${household[0].key} أفراد (${ar(household[0].percent)}٪).`,
              rows: household
                .slice(0, 5)
                .map((r): [string, string] => [`حجم ${r.key}`, `${ar(r.count)} (${ar(r.percent)}٪)`]),
              note: "مؤشر الأسر المستفيدة.",
            },
          ]
        : []),
    ],
    kpis: [
      {
        label: "إجمالي المستفيدين",
        value: ar(s.totalBeneficiaries),
        delta: `${ar(families)} أسرة`,
        rows: [
          ["الأسر المستفيدة", ar(families)],
          ["متوسط حجم الأسرة", ar(s.avgHouseholdSize ?? "—")],
        ],
        note: "من قاعدة مستفيدي المنصة لهذا المعرض.",
      },
      {
        label: "المدعوون",
        value: ar(s.invited),
        delta: s.totalBeneficiaries
          ? `${ar(pctOf(s.invited, s.totalBeneficiaries))}٪ من المسجّلين`
          : undefined,
        rows: [["المدعوون", ar(s.invited)], ["المسجّلون", ar(s.totalBeneficiaries)]],
        note: "دعوات المعرض النشطة.",
      },
      {
        label: "الحضور",
        value: ar(s.attended),
        delta: s.invited ? `${ar(attendPct)}٪ من المدعوين` : undefined,
        rows: [
          ["الحضور", ar(s.attended)],
          ["استثنائي", ar(s.exceptionAttendance ?? 0)],
        ],
        note: "يشمل الحضور العادي والاستثنائي.",
      },
      {
        label: "المستلمون",
        value: ar(s.received),
        delta: s.attended ? `${ar(receiveFromAttendPct)}٪ من الحضور` : undefined,
        rows: [
          ["المستلمون", ar(s.received)],
          ["القطع", ar(s.piecesDispensed)],
          ["صرف استثنائي", ar(s.overrideDispenses ?? 0)],
        ],
        note: "مستفيدون لديهم أمر صرف واحد على الأقل.",
      },
      {
        label: "القطع المصروفة",
        value: ar(s.piecesDispensed),
        rows: top.slice(0, 5).map((t) => [itemLabel(t.attributes), ar(t.quantity)]),
        note: top.length ? "أعلى الأصناف المصروفة." : "لا أصناف بعد.",
      },
    ],
    dist: (assoc.length ? assoc : gender).slice(0, 6).map((row, i) => ({
      label: row.key,
      pct: Math.min(100, Math.max(0, row.percent)),
      color: DIST_COLORS[i % DIST_COLORS.length],
      rows: [
        ["العدد", ar(row.count)],
        ["النسبة", `${ar(row.percent)}٪`],
      ],
      note: assoc.length ? "توزيع حسب الجمعية." : "توزيع حسب الجنس.",
    })),
    funnel: [
      {
        stage: "مسجّلون",
        count: s.totalBeneficiaries,
        pct: 100,
        rows: [["العدد", ar(s.totalBeneficiaries)]],
        note: "قاعدة المستفيدين المرتبطة بالتقرير.",
      },
      {
        stage: "مدعوون",
        count: s.invited,
        pct: pctOf(s.invited, Math.max(s.totalBeneficiaries, 1)),
        rows: [
          ["العدد", ar(s.invited)],
          ["من المسجّلين", `${ar(pctOf(s.invited, Math.max(s.totalBeneficiaries, 1)))}٪`],
        ],
        note: "أُرسلت لهم دعوة للمعرض.",
      },
      {
        stage: "حضور",
        count: s.attended,
        pct: pctOf(s.attended, Math.max(s.totalBeneficiaries, 1)),
        rows: [
          ["العدد", ar(s.attended)],
          ["من المدعوين", `${ar(attendPct)}٪`],
        ],
        note: "تسجيل حضور في المعرض.",
      },
      {
        stage: "استلام",
        count: s.received,
        pct: receiveFromTotalPct,
        rows: [
          ["العدد", ar(s.received)],
          ["من الحضور", `${ar(receiveFromAttendPct)}٪`],
        ],
        note: "تم صرف قطعة واحدة على الأقل.",
      },
    ],
    progress: [
      {
        label: "نسبة الحضور من المدعوين",
        pct: Math.min(100, attendPct),
        rows: [
          ["الحضور", ar(s.attended)],
          ["المدعوون", ar(s.invited)],
        ],
        note: "مؤشر استجابة الدعوة.",
      },
      {
        label: "نسبة الاستلام من الحضور",
        pct: Math.min(100, receiveFromAttendPct),
        rows: [
          ["المستلمون", ar(s.received)],
          ["الحضور", ar(s.attended)],
        ],
        note: "اكتمال مسار الصرف بعد الحضور.",
      },
      {
        label: "نسبة الاستلام من المسجّلين",
        pct: Math.min(100, receiveFromTotalPct),
        rows: [
          ["المستلمون", ar(s.received)],
          ["المسجّلون", ar(s.totalBeneficiaries)],
        ],
        note: "تغطية الصرف على القاعدة كاملة.",
      },
    ],
    programs: top.map((t) => {
      const label = itemLabel(t.attributes);
      const share = pctOf(t.quantity, Math.max(s.piecesDispensed, 1));
      return {
        prog: label,
        total: ar(s.piecesDispensed),
        done: ar(t.quantity),
        pct: `${ar(share)}٪`,
        rows: [
          ["الكمية المصروفة", ar(t.quantity)],
          ["من إجمالي القطع", `${ar(share)}٪`],
        ],
        note: "من أعلى الأصناف المصروفة في المعرض.",
      };
    }),
    timeline: [],
    evidence: [],
    disb: [],
  };
}
