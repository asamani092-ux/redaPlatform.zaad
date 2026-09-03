import type { ShareRow, TopDispensedItem } from "@/lib/report-metrics";

/** مفاتيح شرائح منشئ العرض (بدون الغلاف/الخاتمة الثابتين) */
export const PRESENTATION_SLIDE_OPTIONS = [
  { id: "summary", label: "الملخص التنفيذي" },
  { id: "kpi", label: "المؤشرات الرئيسية" },
  { id: "dist", label: "توزيع الحالات" },
  { id: "funnel", label: "قمع المراحل" },
  { id: "progress", label: "نسب الإنجاز" },
  { id: "table", label: "أداء الأصناف" },
  { id: "timeline", label: "مساهمات المتاجر" },
  { id: "evidence", label: "معرض الشواهد" },
  { id: "disb", label: "تفصيل متبقي المتاجر" },
] as const;

export type PresentationSlideId = (typeof PRESENTATION_SLIDE_OPTIONS)[number]["id"];

/** تسميات مؤشرات KPI كما تُبنى في التقرير */
export const PRESENTATION_KPI_OPTIONS = [
  "إجمالي المستفيدين",
  "الأسر المستفيدة",
  "المدعوون",
  "الحضور",
  "المستلمون",
  "القطع المصروفة",
  "مخزون المنصة",
  "مساهمات المتاجر",
] as const;

/** عقد بيانات منشئ العرض التقديمي (نظام التصميم v1.2.11 — window.ZAD_REPORT) */
export type ZadPresentationReport = {
  title: string;
  period: string;
  /** اسم الجهة على الغلاف والخاتمة */
  orgName?: string;
  /** السطر الثانوي (قسم/إدارة) — aliases: orgLine, closingLine */
  deptName?: string;
  orgLine?: string;
  closingLine?: string;
  closingTitle?: string;
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
    type?: "image" | "video";
    src: string;
    poster?: string;
    caption: string;
    tag: string;
    note?: string;
    rows?: [string, string][];
  }>;
  disb: Array<{
    label: string;
    amount: string;
    rows: [string, string][];
    note?: string;
  }>;
  /** شعارات العرض (حد أقصى 2) — day إلزامي عند الاستخدام، night اختياري للوضع الليلي */
  logos?: Array<{ day: string; night?: string }>;
  /** موضع الشعارات على الشريحة */
  logoPlacement?: "center" | "topRight" | "split" | "rightCenter";
  /** اختيار الشرائح من المنصة قبل فتح المنشئ */
  meta?: {
    on?: Partial<Record<PresentationSlideId, boolean>>;
  };
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
  totalIndividuals?: number;
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
  attributeLabels?: Record<string, string>;
  platformContributed?: number;
  platformDispensed?: number;
  platformRemaining?: number;
  storeContributed?: number;
  storeDispensed?: number;
  storeRemaining?: number;
  storeSummary?: Array<{
    storeName: string;
    skuCode: string;
    attributes: Record<string, unknown>;
    added: number;
    dispensed: number;
    remaining: number;
  }>;
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

function itemLabel(
  attributes: Record<string, unknown>,
  labels?: Record<string, string>,
): string {
  const parts = Object.entries(attributes ?? {}).map(([k, v]) => {
    const name = labels?.[k] ?? k;
    return `${name}: ${String(v)}`;
  });
  return parts.length ? parts.join(" · ") : "صنف";
}

export type PresentationSelection = {
  slides?: string[];
  kpis?: string[];
};

/**
 * تطبيق اختيار الشرائح/المؤشرات على عقد العرض.
 * Time: O(k) — Space: O(k).
 */
export function applyPresentationSelection(
  report: ZadPresentationReport,
  selection?: PresentationSelection | null,
): ZadPresentationReport {
  const slideSet = selection?.slides?.length
    ? new Set(selection.slides)
    : null;
  const on = Object.fromEntries(
    PRESENTATION_SLIDE_OPTIONS.map((s) => [
      s.id,
      slideSet ? slideSet.has(s.id) : true,
    ]),
  ) as Record<PresentationSlideId, boolean>;

  let kpis = report.kpis;
  if (selection?.kpis?.length) {
    const want = new Set(selection.kpis);
    kpis = report.kpis.filter((k) => want.has(k.label));
  }

  return {
    ...report,
    kpis,
    meta: { on },
  };
}

/**
 * تحويل ملخص تقارير المنصة إلى عقد منشئ العرض.
 * Time: O(k) حيث k = عدد صفوف التوزيع/الأصناف؛ Space: O(k).
 */
export function buildZadPresentationReport(
  s: PresentationSummaryInput,
): ZadPresentationReport {
  const attrLabels = s.attributeLabels;
  const families = s.beneficiaryFamilies ?? s.totalBeneficiaries;
  const individuals = s.totalIndividuals ?? s.totalBeneficiaries;
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
    orgName: "منصة رداء",
    deptName: s.exhibitionName,
    closingTitle: "شكراً لكم",
    logos: [
      {
        day: "/zad-presentation/assets/logo-full.png",
        night: "/zad-presentation/assets/logo-white.png",
      },
      { day: "/invite-poster.jpg" },
    ],
    logoPlacement: "center",
    summary: [
      {
        text: `الأسر المستفيدة ${ar(families)} بإجمالي ${ar(individuals)} مستفيداً (أفراد يشملون التابعين).`,
        rows: [
          ["الأسر المستفيدة", ar(families)],
          ["إجمالي المستفيدين (أفراد)", ar(individuals)],
        ],
        note: "الأسرة = سجل مستفيد واحد؛ الأفراد = المستفيد + التابعون.",
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
      ...((s.platformContributed || s.platformDispensed)
        ? ([
            {
              text: `مخزون المنصة: أُضيف ${ar(s.platformContributed ?? 0)} وصُرف ${ar(s.platformDispensed ?? 0)} وتبقّى ${ar(s.platformRemaining ?? 0)}.`,
              rows: [
                ["مضاف من المنصة", ar(s.platformContributed ?? 0)],
                ["مصروف من المنصة", ar(s.platformDispensed ?? 0)],
                ["متبقي للمنصة", ar(s.platformRemaining ?? 0)],
              ] as [string, string][],
              note: "حركات المخزون غير المنسوبة لمتجر.",
            },
          ] as ZadPresentationReport["summary"])
        : []),
      ...(s.storeContributed
        ? ([
            {
              text: `ساهمت المتاجر بـ ${ar(s.storeContributed)} قطعة؛ صُرف منها ${ar(s.storeDispensed ?? 0)} وتبقّى ${ar(s.storeRemaining ?? 0)}.`,
              rows: [
                ["مساهمات المتاجر", ar(s.storeContributed)],
                ["مصروف من المتاجر", ar(s.storeDispensed ?? 0)],
                ["متبقي للمتاجر", ar(s.storeRemaining ?? 0)],
              ] as [string, string][],
              note: "يُحدَّث مع كل حركة مخزون منسوبة لمتجر.",
            },
          ] as ZadPresentationReport["summary"])
        : []),
      ...(city[0]
        ? ([
            {
              text: `أعلى مدينة من حيث المستفيدين: ${city[0].key} بنسبة ${ar(city[0].percent)}٪.`,
              rows: city
                .slice(0, 5)
                .map((r): [string, string] => [r.key, `${ar(r.count)} (${ar(r.percent)}٪)`]),
              note: "توزيع المستفيدين حسب المدينة.",
            },
          ] as ZadPresentationReport["summary"])
        : []),
      ...(household[0]
        ? ([
            {
              text: `أكثر تكرار لعدد الأفراد في السجل: ${household[0].key} (${ar(household[0].percent)}٪).`,
              rows: household
                .slice(0, 5)
                .map((r): [string, string] => [
                  `${r.key} أفراد`,
                  `${ar(r.count)} (${ar(r.percent)}٪)`,
                ]),
              note: "عدد الأفراد = المستفيد + التابعون لكل سجل.",
            },
          ] as ZadPresentationReport["summary"])
        : []),
    ],
    kpis: [
      {
        label: "إجمالي المستفيدين",
        value: ar(individuals),
        delta: `${ar(families)} أسرة`,
        rows: [
          ["الأسر المستفيدة", ar(families)],
          ["إجمالي الأفراد", ar(individuals)],
        ],
        note: "الأفراد = المستفيد + التابعون لكل أسرة.",
      },
      {
        label: "الأسر المستفيدة",
        value: ar(families),
        rows: [
          ["الأسر", ar(families)],
          ["إجمالي الأفراد", ar(individuals)],
        ],
        note: "كل سجل مستفيد يُحسب أسرة واحدة.",
      },
      {
        label: "المدعوون",
        value: ar(s.invited),
        delta: families
          ? `${ar(pctOf(s.invited, families))}٪ من الأسر`
          : undefined,
        rows: [["المدعوون", ar(s.invited)], ["الأسر", ar(families)]],
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
        rows: top
          .slice(0, 5)
          .map(
            (t): [string, string] => [
              itemLabel(t.attributes, attrLabels),
              ar(t.quantity),
            ],
          ),
        note: top.length ? "أعلى الأصناف المصروفة." : "لا أصناف بعد.",
      },
      {
        label: "مخزون المنصة",
        value: ar(s.platformRemaining ?? 0),
        delta: `مصروف ${ar(s.platformDispensed ?? 0)}`,
        rows: [
          ["المضاف من المنصة", ar(s.platformContributed ?? 0)],
          ["المصروف من المنصة", ar(s.platformDispensed ?? 0)],
          ["المتبقي للمنصة", ar(s.platformRemaining ?? 0)],
        ] as [string, string][],
        note: "منتجات وإضافات المنصة خارج مساهمات المتاجر.",
      },
      {
        label: "مساهمات المتاجر",
        value: ar(s.storeContributed ?? 0),
        delta: `متبقي ${ar(s.storeRemaining ?? 0)}`,
        rows: [
          ["المضاف من المتاجر", ar(s.storeContributed ?? 0)],
          ["المصروف من المتاجر", ar(s.storeDispensed ?? 0)],
          ["المتبقي للمتاجر", ar(s.storeRemaining ?? 0)],
        ] as [string, string][],
        note: "حصر مساهمات المتاجر المشاركة في المخزون الموحّد.",
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
      const label = itemLabel(t.attributes, attrLabels);
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
    timeline: (s.storeSummary ?? []).slice(0, 12).map((r) => ({
      title: r.storeName,
      time: r.skuCode,
      rows: [
        ["الصنف", itemLabel(r.attributes, attrLabels)],
        ["مضاف", ar(r.added)],
        ["مصروف", ar(r.dispensed)],
        ["متبقي", ar(r.remaining)],
      ] as [string, string][],
      note: "مساهمة متجر مشارك.",
    })),
    evidence: [],
    disb: (s.storeSummary ?? []).slice(0, 8).map((r) => ({
      label: `${r.storeName} — ${itemLabel(r.attributes, attrLabels)}`,
      amount: ar(r.remaining),
      rows: [
        ["مضاف", ar(r.added)],
        ["مصروف", ar(r.dispensed)],
        ["متبقي", ar(r.remaining)],
      ] as [string, string][],
      note: `رمز ${r.skuCode}`,
    })),
  };
}
