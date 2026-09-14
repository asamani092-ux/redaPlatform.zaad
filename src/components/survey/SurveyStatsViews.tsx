"use client";

import type {
  SurveyOptionStats,
  SurveyQuestionStats,
  SurveyStatBucket,
  SurveyStatsResult,
} from "@/lib/survey-stats";
import {
  SURVEY_STATS_VIEW_COLORS,
  SURVEY_STATS_VIEW_OPTIONS,
  pieSlicePath,
  type SurveyStatsViewId,
} from "@/lib/survey-stats-views";

export function SurveyStatsViewToggles({
  views,
  onChange,
}: {
  views: Set<SurveyStatsViewId>;
  onChange: (next: Set<SurveyStatsViewId>) => void;
}) {
  function toggle(id: SurveyStatsViewId) {
    const next = new Set(views);
    if (next.has(id)) {
      if (next.size === 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  }

  return (
    <div className="ss-toggles" role="group" aria-label="أشكال عرض الإحصائيات">
      {SURVEY_STATS_VIEW_OPTIONS.map((o) => (
        <label key={o.id} className="ss-toggle">
          <input
            type="checkbox"
            checked={views.has(o.id)}
            onChange={() => toggle(o.id)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function AvgCard({
  average,
  label = "المتوسط",
}: {
  average: number | null;
  label?: string;
}) {
  if (average == null) return null;
  return (
    <div className="ss-block ss-avg">
      <h4 className="ss-block-title">{label}</h4>
      <div className="ss-avg-value">{average}</div>
    </div>
  );
}

function StatsTable({ buckets }: { buckets: SurveyStatBucket[] }) {
  if (!buckets.length) return null;
  return (
    <div className="ss-block">
      <h4 className="ss-block-title">جدول النسب</h4>
      <div className="ss-table-scroll">
        <table className="ss-table">
          <thead>
            <tr>
              <th>الإجابة</th>
              <th>العدد</th>
              <th>النسبة</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.label}>
                <td className="ss-cell-label">{b.label}</td>
                <td className="ss-cell-num">{b.count}</td>
                <td className="ss-cell-num">{b.percent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatsBars({ buckets }: { buckets: SurveyStatBucket[] }) {
  if (!buckets.length) return null;
  return (
    <div className="ss-block">
      <h4 className="ss-block-title">أشرطة أفقية</h4>
      {buckets.map((b) => (
        <div key={b.label} className="ss-bar-row">
          <div className="ss-bar-label">{b.label}</div>
          <div className="ss-bar-meta">
            {b.count} ({b.percent}%)
          </div>
          <div className="ss-bar-track" aria-hidden>
            <div
              className="ss-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, b.percent))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsPie({ buckets }: { buckets: SurveyStatBucket[] }) {
  if (!buckets.length) return null;
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const answered = buckets.reduce((s, b) => s + b.count, 0);
  let angle = 0;
  const slices: Array<{ d: string; color: string; key: string }> = [];
  if (answered > 0) {
    buckets.forEach((b, i) => {
      if (b.count <= 0) return;
      const sweep = (b.count / answered) * 360;
      slices.push({
        key: b.label,
        d: pieSlicePath(cx, cy, r, angle, angle + sweep),
        color: SURVEY_STATS_VIEW_COLORS[i % SURVEY_STATS_VIEW_COLORS.length]!,
      });
      angle += sweep;
    });
  }

  return (
    <div className="ss-block">
      <h4 className="ss-block-title">دائرة النسب</h4>
      <div className="ss-pie-layout">
        <svg
          className="ss-pie"
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label="دائرة نسب"
        >
          {slices.length ? (
            slices.map((s) => <path key={s.key} d={s.d} fill={s.color} />)
          ) : (
            <circle cx={cx} cy={cy} r={r} fill="#eee" />
          )}
        </svg>
        <ul className="ss-legend">
          {buckets.map((b, i) => (
            <li key={b.label}>
              <span
                className="ss-swatch"
                style={{
                  background:
                    SURVEY_STATS_VIEW_COLORS[i % SURVEY_STATS_VIEW_COLORS.length],
                }}
              />
              <span className="ss-legend-label">{b.label}</span>
              <span className="ss-legend-meta">
                {b.count} ({b.percent}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatsStacked({ buckets }: { buckets: SurveyStatBucket[] }) {
  if (!buckets.length) return null;
  const answered = buckets.reduce((s, b) => s + b.count, 0);
  if (answered <= 0) return null;
  const visible = buckets.filter((b) => b.count > 0);
  return (
    <div className="ss-block">
      <h4 className="ss-block-title">شريط مكدّس</h4>
      <div className="ss-stack" aria-hidden>
        {visible.map((b, i) => (
          <span
            key={b.label}
            className="ss-stack-seg"
            title={`${b.label}: ${b.percent}%`}
            style={{
              width: `${(b.count / answered) * 100}%`,
              background:
                SURVEY_STATS_VIEW_COLORS[i % SURVEY_STATS_VIEW_COLORS.length],
            }}
          />
        ))}
      </div>
      <ul className="ss-legend">
        {buckets.map((b, i) => (
          <li key={b.label}>
            <span
              className="ss-swatch"
              style={{
                background:
                  SURVEY_STATS_VIEW_COLORS[i % SURVEY_STATS_VIEW_COLORS.length],
              }}
            />
            <span className="ss-legend-label">{b.label}</span>
            <span className="ss-legend-meta">
              {b.count} ({b.percent}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatsTexts({ q }: { q: SurveyQuestionStats }) {
  if (!q.textReplies.length) {
    if (q.questionType !== "text") return null;
    return <p className="ss-meta">لا ردود نصية.</p>;
  }
  return (
    <div className="ss-block ss-texts">
      <h4 className="ss-block-title">الردود النصية ({q.textReplies.length})</h4>
      <ul className="ss-texts-list">
        {q.textReplies.map((t) => (
          <li key={`${t.responseId}-${t.text.slice(0, 24)}`}>
            <div className="ss-text-head">
              <strong>{t.beneficiaryName}</strong>
              <span className="meta-ltr">{t.nationalId}</span>
              <span className="meta-ltr">
                {new Date(t.createdAt).toLocaleString("ar-SA")}
              </span>
            </div>
            <p className="ss-text-body">{t.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BucketViews({
  buckets,
  views,
  average,
  avgLabel,
}: {
  buckets: SurveyStatBucket[];
  views: Set<SurveyStatsViewId>;
  average: number | null;
  avgLabel?: string;
}) {
  return (
    <>
      {views.has("avg") ? <AvgCard average={average} label={avgLabel} /> : null}
      {views.has("table") ? <StatsTable buckets={buckets} /> : null}
      {views.has("bars") ? <StatsBars buckets={buckets} /> : null}
      {views.has("pie") ? <StatsPie buckets={buckets} /> : null}
      {views.has("stacked") ? <StatsStacked buckets={buckets} /> : null}
    </>
  );
}

function OptionBlock({
  opt,
  views,
}: {
  opt: SurveyOptionStats;
  views: Set<SurveyStatsViewId>;
}) {
  return (
    <div className="ss-option">
      <h4 className="ss-option-title">{opt.option}</h4>
      <BucketViews
        buckets={opt.buckets}
        views={views}
        average={opt.average}
        avgLabel="متوسط الخيار"
      />
    </div>
  );
}

export function SurveyQuestionStatsViews({
  question,
  views,
}: {
  question: SurveyQuestionStats;
  views: Set<SurveyStatsViewId>;
}) {
  return (
    <article className="ss-question">
      <h3 className="ss-question-title">{question.questionText}</h3>
      <p className="ss-meta">مجيبون: {question.answeredCount}</p>

      {question.optionStats?.length ? (
        question.optionStats.map((opt) => (
          <OptionBlock key={opt.option} opt={opt} views={views} />
        ))
      ) : question.buckets.length ? (
        <BucketViews
          buckets={question.buckets}
          views={views}
          average={question.average}
        />
      ) : null}

      {views.has("texts") ? <StatsTexts q={question} /> : null}
    </article>
  );
}

export function SurveyStatsPanels({
  stats,
  views,
}: {
  stats: SurveyStatsResult;
  views: Set<SurveyStatsViewId>;
}) {
  return (
    <div className="survey-stats-stack">
      <div className="stat-grid">
        <div className="stat-tile">
          <div className="value">{stats.totalResponses}</div>
          <div className="label">إجمالي الردود</div>
        </div>
        <div className="stat-tile">
          <div className="value">{stats.questions.length}</div>
          <div className="label">عدد الأسئلة</div>
        </div>
      </div>
      {stats.questions.map((q) => (
        <SurveyQuestionStatsViews
          key={q.questionId}
          question={q}
          views={views}
        />
      ))}
    </div>
  );
}
