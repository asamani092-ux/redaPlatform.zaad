"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  SurveyPublicBrand,
  SurveyPublicForm,
} from "@/components/SurveyPublicForm";
import type { SurveyQuestion } from "@/lib/survey-questions";

type Payload = {
  mode: "internal" | "external";
  title: string;
  exhibitionName: string;
  questions: SurveyQuestion[];
  externalUrl: string | null;
};

export default function SurveyPreviewPage() {
  const params = useParams<{ surveyId: string }>();
  const surveyId = params?.surveyId ?? "";
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!surveyId) return;
    const res = await fetch(`/api/s/preview/${encodeURIComponent(surveyId)}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(String(json.error || "تعذّر فتح المعاينة"));
      setData(null);
      return;
    }
    setError("");
    setData(json as Payload);
  }, [surveyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <main className="survey-public-page">
        <div className="survey-public">
          <p className="survey-public__error">{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="survey-public-page">
        <div className="survey-public">
          <p className="survey-public__empty">جاري التحميل…</p>
        </div>
      </main>
    );
  }

  if (data.mode === "external") {
    return (
      <main className="survey-public-page">
        <div className="survey-public">
          <SurveyPublicBrand
            title={data.title}
            exhibitionName={data.exhibitionName}
          />
          <p className="survey-public__badge" role="status">
            معاينة رابط خارجي — الردود تُحفظ على المنصة الخارجية
          </p>
          <p className="survey-public__external-url" dir="ltr">
            {data.externalUrl}
          </p>
          {data.externalUrl ? (
            <a
              className="survey-public__submit"
              href={data.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              فتح الرابط الخارجي
            </a>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="survey-public-page">
      <SurveyPublicForm
        preview
        title={data.title}
        exhibitionName={data.exhibitionName}
        questions={data.questions}
      />
    </main>
  );
}
