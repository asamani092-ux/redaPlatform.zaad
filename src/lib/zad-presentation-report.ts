import type { ShareRow, TopDispensedItem } from "@/lib/report-metrics";
import {
  FUNNEL_NOTE,
  FUNNEL_STAGE_LABELS,
  PRESENTATION_KPI_OPTIONS as KPI_OPTION_LIST,
  REPORT_KPI_LABELS,
} from "@/lib/report-kpi-labels";

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

/** تسميات مؤشرات KPI كما تُبنى في التقرير — مصدر موحّد */
export const PRESENTATION_KPI_OPTIONS = KPI_OPTION_LIST;

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
  invitedIndividuals?: number;
  attendedIndividuals?: number;
  receivedIndividuals?: number;
  attendedNotReceived?: number;
  attendanceFromInvitedPct?: number;
  receivedFromAttendedPct?: number;
  clothesPieces?: number;
  fabricMeters?: number;
  repeatDispenseFamilies?: number;
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

  const invitedIndividuals = s.invitedIndividuals ?? s.invited;
  const attendedIndividuals = s.attendedIndividuals ?? s.attended;
  const receivedIndividuals = s.receivedIndividuals ?? s.received;
  const attendedNotReceived =
    s.attendedNotReceived ?? Math.max(0, s.attended - s.received);
  const attendanceFromInvitedPct =
    s.attendanceFromInvitedPct ?? attendPct;
  const receivedFromAttendedPct =
    s.receivedFromAttendedPct ?? receiveFromAttendPct;
  const clothesPieces = s.clothesPieces ?? 0;
  const fabricMeters = s.fabricMeters ?? 0;
  const repeatDispenseFamilies = s.repeatDispenseFamilies ?? 0;

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
      { day: "/invite-poster.png" },
    ],
    logoPlacement: "center",
    summary: [
      {
        text: `${REPORT_KPI_LABELS.registeredFamilies} ${ar(families)} بإجمالي ${ar(individuals)} (${REPORT_KPI_LABELS.totalIndividuals}).`,
        rows: [
          [REPORT_KPI_LABELS.registeredFamilies, ar(families)],
          [REPORT_KPI_LABELS.totalIndividuals, ar(individuals)],
        ],
        note: "الأسرة = سجل مستفيد واحد؛ الأفراد = المستفيد + التابعون.",
      },
      {
        text: `دُعيت ${ar(s.invited)} أسرة وحضرت ${ar(s.attended)} واستلمت ${ar(s.received)}.`,
        rows: [
          [REPORT_KPI_LABELS.invitedFamilies, ar(s.invited)],
          [REPORT_KPI_LABELS.attendedFamilies, ar(s.attended)],
          [REPORT_KPI_LABELS.receivedFamilies, ar(s.received)],
          [REPORT_KPI_LABELS.attendedNotReceived, ar(attendedNotReceived)],
        ],
        note: "مسار الدعوة → الحضور → الاستلام (أسر).",
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
        label: REPORT_KPI_LABELS.totalIndividuals,
        value: ar(individuals),
        delta: `${ar(families)} أسرة`,
        rows: [
          [REPORT_KPI_LABELS.registeredFamilies, ar(families)],
          [REPORT_KPI_LABELS.totalIndividuals, ar(individuals)],
        ],
        note: "الأفراد = المستفيد + التابعون لكل أسرة.",
      },
      {
        label: REPORT_KPI_LABELS.registeredFamilies,
        value: ar(families),
        rows: [
          [REPORT_KPI_LABELS.registeredFamilies, ar(families)],
          [REPORT_KPI_LABELS.totalIndividuals, ar(individuals)],
        ],
        note: "كل سجل مستفيد يُحسب أسرة واحدة.",
      },
      {
        label: REPORT_KPI_LABELS.invitedFamilies,
        value: ar(s.invited),
        delta: families
          ? `${ar(pctOf(s.invited, families))}٪ من الأسر`
          : undefined,
        rows: [
          [REPORT_KPI_LABELS.invitedFamilies, ar(s.invited)],
          ["أفراد مدعوون", ar(invitedIndividuals)],
        ],
        note: "دعوات المعرض النشطة (أسر).",
      },
      {
        label: REPORT_KPI_LABELS.attendedFamilies,
        value: ar(s.attended),
        delta: s.invited ? `${ar(attendanceFromInvitedPct)}٪ من المدعوّة` : undefined,
        rows: [
          [REPORT_KPI_LABELS.attendedFamilies, ar(s.attended)],
          [REPORT_KPI_LABELS.attendedIndividuals, ar(attendedIndividuals)],
        ],
        note: "يشمل الحضور العادي والاستثنائي.",
      },
      {
        label: REPORT_KPI_LABELS.receivedFamilies,
        value: ar(s.received),
        delta: s.attended ? `${ar(receivedFromAttendedPct)}٪ من الحاضرة` : undefined,
        rows: [
          [REPORT_KPI_LABELS.receivedFamilies, ar(s.received)],
          [REPORT_KPI_LABELS.piecesDispensed, ar(s.piecesDispensed)],
        ],
        note: "أسر لديها أمر صرف واحد على الأقل.",
      },
      {
        label: REPORT_KPI_LABELS.receivedIndividuals,
        value: ar(receivedIndividuals),
        rows: [
          [REPORT_KPI_LABELS.receivedFamilies, ar(s.received)],
          [REPORT_KPI_LABELS.receivedIndividuals, ar(receivedIndividuals)],
        ],
        note: "مجموع أحجام أسر المستلِمين.",
      },
      {
        label: REPORT_KPI_LABELS.attendedNotReceived,
        value: ar(attendedNotReceived),
        rows: [
          [REPORT_KPI_LABELS.attendedFamilies, ar(s.attended)],
          [REPORT_KPI_LABELS.receivedFamilies, ar(s.received)],
        ],
        note: "حضور − استلام (أسر).",
      },
      {
        label: REPORT_KPI_LABELS.attendanceFromInvitedPct,
        value: `${ar(attendanceFromInvitedPct)}٪`,
        rows: [
          [REPORT_KPI_LABELS.attendedFamilies, ar(s.attended)],
          [REPORT_KPI_LABELS.invitedFamilies, ar(s.invited)],
        ],
        note: "نسبة الأسر الحاضرة من المدعوّة.",
      },
      {
        label: REPORT_KPI_LABELS.receivedFromAttendedPct,
        value: `${ar(receivedFromAttendedPct)}٪`,
        rows: [
          [REPORT_KPI_LABELS.receivedFamilies, ar(s.received)],
          [REPORT_KPI_LABELS.attendedFamilies, ar(s.attended)],
        ],
        note: "نسبة الأسر المستلِمة من الحاضرة.",
      },
      {
        label: REPORT_KPI_LABELS.piecesDispensed,
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
        label: REPORT_KPI_LABELS.clothesPieces,
        value: ar(clothesPieces),
        rows: [
          [REPORT_KPI_LABELS.clothesPieces, ar(clothesPieces)],
          [REPORT_KPI_LABELS.fabricMeters, ar(fabricMeters)],
        ],
        note: "من تصنيف سمات المخزون كما في العرض الحي.",
      },
      {
        label: REPORT_KPI_LABELS.fabricMeters,
        value: ar(fabricMeters),
        rows: [
          [REPORT_KPI_LABELS.fabricMeters, ar(fabricMeters)],
          [REPORT_KPI_LABELS.clothesPieces, ar(clothesPieces)],
        ],
        note: "من تصنيف سمات المخزون كما في العرض الحي.",
      },
      {
        label: REPORT_KPI_LABELS.repeatDispenseFamilies,
        value: ar(repeatDispenseFamilies),
        rows: [
          [REPORT_KPI_LABELS.repeatDispenseFamilies, ar(repeatDispenseFamilies)],
          [REPORT_KPI_LABELS.receivedFamilies, ar(s.received)],
        ],
        note: "أسر لها أكثر من أمر صرف في المعرض.",
      },
      {
        label: REPORT_KPI_LABELS.platformRemaining,
        value: ar(s.platformRemaining ?? 0),
        delta: `مصروف ${ar(s.platformDispensed ?? 0)}`,
        rows: [
          [REPORT_KPI_LABELS.platformContributed, ar(s.platformContributed ?? 0)],
          [REPORT_KPI_LABELS.platformDispensed, ar(s.platformDispensed ?? 0)],
          [REPORT_KPI_LABELS.platformRemaining, ar(s.platformRemaining ?? 0)],
        ] as [string, string][],
        note: "منتجات وإضافات المنصة خارج مساهمات المتاجر.",
      },
      {
        label: REPORT_KPI_LABELS.storeContributed,
        value: ar(s.storeContributed ?? 0),
        delta: `متبقي ${ar(s.storeRemaining ?? 0)}`,
        rows: [
          [REPORT_KPI_LABELS.storeContributed, ar(s.storeContributed ?? 0)],
          [REPORT_KPI_LABELS.storeDispensed, ar(s.storeDispensed ?? 0)],
          [REPORT_KPI_LABELS.storeRemaining, ar(s.storeRemaining ?? 0)],
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
        stage: FUNNEL_STAGE_LABELS.registered,
        count: families,
        pct: 100,
        rows: [
          ["أسر", ar(families)],
          ["أفراد", ar(individuals)],
        ],
        note: FUNNEL_NOTE,
      },
      {
        stage: FUNNEL_STAGE_LABELS.invited,
        count: s.invited,
        pct: pctOf(s.invited, Math.max(families, 1)),
        rows: [
          ["أسر", ar(s.invited)],
          ["أفراد", ar(invitedIndividuals)],
          ["من المسجّلين", `${ar(pctOf(s.invited, Math.max(families, 1)))}٪`],
        ],
        note: FUNNEL_NOTE,
      },
      {
        stage: FUNNEL_STAGE_LABELS.attended,
        count: s.attended,
        pct: pctOf(s.attended, Math.max(families, 1)),
        rows: [
          ["أسر", ar(s.attended)],
          ["أفراد", ar(attendedIndividuals)],
          ["من المدعوّة", `${ar(attendanceFromInvitedPct)}٪`],
        ],
        note: FUNNEL_NOTE,
      },
      {
        stage: FUNNEL_STAGE_LABELS.received,
        count: s.received,
        pct: pctOf(s.received, Math.max(families, 1)),
        rows: [
          ["أسر", ar(s.received)],
          ["أفراد", ar(receivedIndividuals)],
          ["من الحاضرة", `${ar(receivedFromAttendedPct)}٪`],
        ],
        note: FUNNEL_NOTE,
      },
    ],
    progress: [
      {
        label: REPORT_KPI_LABELS.attendanceFromInvitedPct,
        pct: Math.min(100, attendanceFromInvitedPct),
        rows: [
          [REPORT_KPI_LABELS.attendedFamilies, ar(s.attended)],
          [REPORT_KPI_LABELS.invitedFamilies, ar(s.invited)],
        ],
        note: "مؤشر استجابة الدعوة (أسر).",
      },
      {
        label: REPORT_KPI_LABELS.receivedFromAttendedPct,
        pct: Math.min(100, receivedFromAttendedPct),
        rows: [
          [REPORT_KPI_LABELS.receivedFamilies, ar(s.received)],
          [REPORT_KPI_LABELS.attendedFamilies, ar(s.attended)],
        ],
        note: "اكتمال مسار الصرف بعد الحضور (أسر).",
      },
      {
        label: "نسبة الأسر المستلِمة من المسجّلة",
        pct: Math.min(100, pctOf(s.received, Math.max(families, 1))),
        rows: [
          [REPORT_KPI_LABELS.receivedFamilies, ar(s.received)],
          [REPORT_KPI_LABELS.registeredFamilies, ar(families)],
        ],
        note: "تغطية الصرف على القاعدة (أسر).",
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
