"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SurveyPublicForm } from "@/components/SurveyPublicForm";
import type { SurveyQuestion } from "@/lib/survey-questions";

type Payload = {
  title: string;
  exhibitionName: string;
  questions: SurveyQuestion[];
  alreadySubmitted: boolean;
};

export default function PublicSurveyPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`/api/s/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(String(json.error || "تعذّر فتح الاستبيان"));
      setData(null);
      return;
    }
    setError("");
    setData(json as Payload);
  }, [token]);

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

  return (
    <main className="survey-public-page">
      <SurveyPublicForm
        title={data.title}
        exhibitionName={data.exhibitionName}
        questions={data.questions}
        token={token}
        alreadySubmitted={data.alreadySubmitted}
      />
    </main>
  );
}
