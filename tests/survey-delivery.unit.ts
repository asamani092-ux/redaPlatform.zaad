import { assert } from "./helpers";
import {
  enforceSurveyExclusivity,
  resolveSurveyDelivery,
  resolveSurveyMode,
  signSurveyToken,
  validateSurveyExclusivity,
  verifySurveyToken,
} from "../src/lib/survey-link";
import {
  buildSurveyMessage,
  resolveSurveyWhatsAppOptions,
  surveyTemplateParams,
  surveyZadTemplateParams,
} from "../src/lib/survey-message";
import type { SurveyDefinition } from "../src/lib/survey-questions";
import { ASSOCIATION_ZAD_NAME } from "../src/lib/survey-questions";
import {
  SURVEY_BROADCAST_BATCH_SIZE,
  buildSurveyBroadcastBatches,
} from "../src/lib/survey-broadcast-batches";

console.log("=== survey delivery modes (external priority) ===");

const base: SurveyDefinition = {
  id: "sv1",
  title: "رضا",
  audience: "received",
  questions: [],
  externalUrl: null,
  autoSendOnDispense: false,
  active: true,
};

assert(resolveSurveyMode(base) === "invalid", "empty survey is invalid");

const withQuestions: SurveyDefinition = {
  ...base,
  questions: [{ id: "q1", text: "كيف كانت الخدمة؟", type: "text" }],
};
assert(resolveSurveyMode(withQuestions) === "internal", "questions => internal");

const withExternal: SurveyDefinition = {
  ...base,
  externalUrl: "https://forms.example/x",
};
assert(resolveSurveyMode(withExternal) === "external", "url => external");

const both: SurveyDefinition = {
  ...base,
  questions: [{ id: "q1", text: "س", type: "text" }],
  externalUrl: "https://forms.example/x",
};
assert(resolveSurveyMode(both) === "external", "both => external priority");
assert(validateSurveyExclusivity(both) === null, "validate allows both");

const enforcedBoth = enforceSurveyExclusivity(both);
assert(enforcedBoth.questions.length === 1, "enforce keeps questions");
assert(enforcedBoth.externalUrl === "https://forms.example/x", "enforce keeps url");

console.log("OK modes + priority");

console.log("=== survey token + delivery url ===");

const token = signSurveyToken({
  exhibitionId: "ex1",
  surveyId: "sv1",
  beneficiaryId: "b1",
});
const payload = verifySurveyToken(token);
assert(payload?.exhibitionId === "ex1", "token exhibition");
assert(payload?.surveyId === "sv1", "token survey");
assert(payload?.beneficiaryId === "b1", "token beneficiary");
assert(verifySurveyToken("bad.token") === null, "bad token rejected");

const internal = resolveSurveyDelivery({
  survey: withQuestions,
  exhibitionId: "ex1",
  beneficiaryId: "b1",
  origin: "https://app.example",
});
assert(internal.ok === true, "internal delivery ok");
if (internal.ok) {
  assert(internal.mode === "internal", "internal mode");
  assert(internal.url.startsWith("https://app.example/s/"), `url ${internal.url}`);
  assert(
    buildSurveyMessage("أحمد", "معرض", internal.url, "رضا").includes(internal.url),
    "message includes internal url",
  );
  assert(
    surveyTemplateParams("أحمد", "معرض", internal.url)[2] === internal.url,
    "template url is internal",
  );
}

const external = resolveSurveyDelivery({
  survey: withExternal,
  exhibitionId: "ex1",
  beneficiaryId: "b1",
  origin: "https://app.example",
});
assert(external.ok === true, "external delivery ok");
if (external.ok) {
  assert(external.url === "https://forms.example/x", "external url passthrough");
}

const bothDelivery = resolveSurveyDelivery({
  survey: both,
  exhibitionId: "ex1",
  beneficiaryId: "b1",
});
assert(bothDelivery.ok === true, "both delivery ok");
if (bothDelivery.ok) {
  assert(bothDelivery.mode === "external", "both uses external");
  assert(bothDelivery.url === "https://forms.example/x", "both url is external");
}

console.log("OK token + delivery");

console.log("=== zad template + batches ===");

assert(ASSOCIATION_ZAD_NAME === "جمعية الزاد", "zad association name");
const zadParams = surveyZadTemplateParams("https://forms.example/zad");
assert(zadParams.length === 1, "zad params length 1");
assert(zadParams[0] === "https://forms.example/zad", "zad params url");

const zadOpts = resolveSurveyWhatsAppOptions({
  audience: "association_zad",
  name: "أحمد",
  exhibitionName: "معرض",
  surveyUrl: "https://forms.example/zad",
  surveyZadTemplateId: "tpl-zad",
  surveyHeaderImageUrl: "https://cdn.example/h.jpg",
});
assert(zadOpts.templateParams.length === 1, "zad wa params length");
assert(zadOpts.mediaUrl === undefined, "zad no header");
assert(zadOpts.templateIdOverride === "tpl-zad", "zad template override");

let missingTplThrew = false;
try {
  resolveSurveyWhatsAppOptions({
    audience: "association_zad",
    name: "أحمد",
    exhibitionName: "معرض",
    surveyUrl: "https://forms.example/zad",
    surveyZadTemplateId: null,
    surveyHeaderImageUrl: null,
  });
} catch (err) {
  missingTplThrew =
    err instanceof Error && err.message.includes("WHATSAPP_SURVEY_ZAD_TEMPLATE_ID");
}
assert(missingTplThrew, "missing zad template id must throw");

const normalOpts = resolveSurveyWhatsAppOptions({
  audience: "received",
  name: "أحمد",
  exhibitionName: "معرض",
  surveyUrl: "https://app.example/s/x",
  surveyZadTemplateId: "tpl-zad",
  surveyHeaderImageUrl: null,
});
assert(normalOpts.templateParams.length === 3, "normal params length 3");
assert(normalOpts.templateIdOverride === undefined, "normal no override");

assert(SURVEY_BROADCAST_BATCH_SIZE === 200, "batch size 200");
const batches = buildSurveyBroadcastBatches(450);
assert(batches.length === 3, "450 => 3 batches");
assert(batches[0]!.size === 200, "batch0 200");
assert(batches[1]!.size === 200, "batch1 200");
assert(batches[2]!.size === 50, "batch2 50");

console.log("OK zad template + batches");
