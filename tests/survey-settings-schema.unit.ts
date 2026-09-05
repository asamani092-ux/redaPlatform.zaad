/**
 * يضمن قبول مخطط إعدادات الاستبيان للأنواع الجديدة.
 * Time: O(1) لكل حالة.
 */
import { z } from "zod";

const surveyQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z
    .enum(["scale", "text", "rated_options", "choice_with_other"])
    .optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  options: z.array(z.string()).optional(),
  allowOther: z.boolean().optional(),
  maxLength: z.number().int().positive().optional(),
  textExpand: z.boolean().optional(),
  minRows: z.number().int().positive().optional(),
  maxRows: z.number().int().positive().optional(),
});

const surveyDefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  audience: z.enum(["attended_only", "received", "invited_absent"]),
  questions: z.array(surveyQuestionSchema).default([]),
  externalUrl: z.string().nullable().optional(),
  autoSendOnDispense: z.boolean().optional(),
  active: z.boolean().optional(),
});

const payload = {
  surveys: [
    {
      id: "sv1",
      title: "رضا",
      audience: "received",
      active: true,
      autoSendOnDispense: false,
      externalUrl: null,
      questions: [
        {
          id: "q1",
          text: "قيّم البنود",
          type: "rated_options",
          options: ["الجودة", "السرعة"],
        },
        {
          id: "q2",
          text: "سبب الزيارة",
          type: "choice_with_other",
          options: ["دعوة", "صديق"],
          allowOther: true,
          maxLength: 200,
          textExpand: true,
          minRows: 3,
          maxRows: 8,
        },
        {
          id: "q3",
          text: "ملاحظة",
          type: "text",
          maxLength: 500,
          textExpand: true,
          minRows: 3,
          maxRows: 8,
        },
      ],
    },
  ],
};

const parsed = z.object({ surveys: z.array(surveyDefSchema) }).safeParse(payload);
if (!parsed.success) {
  console.error(parsed.error.flatten());
  throw new Error("survey-settings-schema.unit: fail");
}

const rejected = surveyQuestionSchema.safeParse({
  id: "x",
  text: "y",
  type: "rated_options",
});
if (!rejected.success) {
  throw new Error("survey-settings-schema.unit: rated_options must pass");
}

console.log("survey-settings-schema.unit: ok");
