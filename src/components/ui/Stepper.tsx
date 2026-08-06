export type StepItem = { id: string; label: string };

export function Stepper({
  steps,
  currentId,
}: {
  steps: StepItem[];
  currentId: string;
}) {
  const idx = steps.findIndex((s) => s.id === currentId);
  return (
    <ol className="zad-stepper" aria-label="خطوات">
      {steps.map((s, i) => {
        const state = i < idx ? "is-done" : i === idx ? "is-current" : "";
        return (
          <li key={s.id} className={`zad-stepper__item ${state}`}>
            <span className="zad-stepper__dot" aria-hidden>
              {i + 1}
            </span>
            <span>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
