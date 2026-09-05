/**
 * متغيرات/هيدر قالب الاستبيان.
 * Time: O(1) لكل حالة.
 */
import assert from "node:assert/strict";
import {
  resolveSurveyHeaderImageUrl,
  sanitizeWaTemplateParam,
  surveyTemplateParams,
} from "../src/lib/survey-message";

assert.equal(
  sanitizeWaTemplateParam("علي\nمحمد\t  "),
  "علي محمد",
);
assert.equal(
  surveyTemplateParams("سارة", "معرض رداء", "https://example.com/s/abc").length,
  3,
);
assert.equal(
  surveyTemplateParams("سارة", "معرض رداء", "https://example.com/s/abc")[2],
  "https://example.com/s/abc",
);

process.env.WHATSAPP_SURVEY_HEADER_IMAGE_URL =
  "https://cdn.example/survey.jpg";
assert.equal(
  resolveSurveyHeaderImageUrl(null),
  "https://cdn.example/survey.jpg",
);
delete process.env.WHATSAPP_SURVEY_HEADER_IMAGE_URL;
process.env.WHATSAPP_INVITE_HEADER_IMAGE_URL =
  "https://cdn.example/invite-poster.jpeg";
assert.equal(
  resolveSurveyHeaderImageUrl(null),
  "https://cdn.example/invite-poster.jpeg",
);

console.log("survey-wa-header.unit: ok");
