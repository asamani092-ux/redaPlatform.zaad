import { assert } from "./helpers";
import {
  dispenseKind,
  sumDispensedByKind,
} from "../src/lib/exhibition-kpis";

console.log("=== dispenseKind classification ===");

assert(
  dispenseKind({ type: "ملابس رجالي", unit: "قطعة" }) === "clothes",
  "ملابس → clothes",
);
assert(
  dispenseKind({ type: "قماش قطن", unit: "متر" }) === "fabric",
  "قماش → fabric",
);
assert(
  dispenseKind({ type: "أخرى", unit: "قطعة" }) === "clothes",
  "وحدة قطعة → clothes",
);
assert(
  dispenseKind({ type: "أخرى", unit: "متر" }) === "fabric",
  "وحدة متر → fabric",
);
assert(
  dispenseKind({ type: "هدية", unit: "علبة" }) === "other",
  "غير معروف → other",
);
console.log("OK dispenseKind");

console.log("=== sumDispensedByKind ===");

const summed = sumDispensedByKind([
  { quantity: 3, attributes: { type: "ملابس", unit: "قطعة" } },
  { quantity: 2.5, attributes: { type: "قماش", unit: "متر" } },
  { quantity: 1, attributes: { type: "هدية", unit: "علبة" } },
  { quantity: 0, attributes: { type: "ملابس", unit: "قطعة" } },
  { quantity: -2, attributes: { type: "قماش", unit: "متر" } },
]);

assert(summed.clothesPieces === 4, `clothesPieces ${summed.clothesPieces}`);
assert(summed.fabricMeters === 2.5, `fabricMeters ${summed.fabricMeters}`);
console.log("OK sumDispensedByKind", summed);
