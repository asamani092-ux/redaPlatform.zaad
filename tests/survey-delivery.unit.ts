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
  surveyTemplateParams,
} from "../src/lib/survey-message";
import type { SurveyDefinition } from "../src/lib/survey-questions";

console.log("=== survey delivery modes ===");

const base: SurveyDefinition = {
  id: "sv1",
  title: "رضا",
  audience: "received",
  questions: [],
  externalUrl: null,
  autoSendOnDispense: false,
  active: true,
};

assert(
  resolveSurveyMode(base) === "invalid",
  "empty survey is invalid",
);

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
assert(resolveSurveyMode(both) === "invalid", "both => invalid");
assert(
  validateSurveyExclusivity(both)?.includes("الجمع") === true,
  "validate rejects both",
);

const enforcedExt = enforceSurveyExclusivity(withExternal);
assert(enforcedExt.questions.length === 0, "external clears questions");
const enforcedInt = enforceSurveyExclusivity(withQuestions);
assert(enforcedInt.externalUrl === null, "questions clear external");

console.log("OK modes + exclusivity");

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
  assert(
    surveyTemplateParams("أحمد", "معرض", external.url)[2] ===
      "https://forms.example/x",
    "template keeps external",
  );
}

const invalid = resolveSurveyDelivery({
  survey: both,
  exhibitionId: "ex1",
  beneficiaryId: "b1",
});
assert(invalid.ok === false, "invalid delivery rejected");

console.log("OK token + delivery + template params");
