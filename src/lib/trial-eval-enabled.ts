/** تفعيل صفحة تقييم التجربة عبر متغير البيئة — يُوقف قبل الإطلاق النهائي */
export function isTrialEvalEnabled(): boolean {
  const v = process.env.TRIAL_EVAL_ENABLED ?? process.env.NEXT_PUBLIC_TRIAL_EVAL_ENABLED;
  return v === "1" || v === "true" || v === "yes";
}
