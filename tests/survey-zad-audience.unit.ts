/**
 * مطابقة تسمية جمعية الزاد لجمهور الاستبيان.
 * Time: O(1) لكل حالة.
 */
import { assert } from "./helpers";
import {
  ASSOCIATION_ZAD_NAME,
  isZadAssociationLabel,
} from "../src/lib/survey-questions";

assert(ASSOCIATION_ZAD_NAME === "جمعية الزاد", "canonical name");

assert(isZadAssociationLabel("جمعية الزاد") === true, "exact name");
assert(isZadAssociationLabel("  جمعية الزاد  ") === true, "trimmed");
assert(isZadAssociationLabel("جمعية الزاد الخيرية") === true, "contains زاد");
assert(isZadAssociationLabel("الزاد") === true, "short label");
assert(isZadAssociationLabel("جمعية البر") === false, "other association");
assert(isZadAssociationLabel("غير الزاد") === false, "negation");
assert(isZadAssociationLabel("") === false, "empty");
assert(isZadAssociationLabel(null) === false, "null");

console.log("survey-zad-audience.unit: ok");
