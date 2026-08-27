import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getActiveExhibition } from "@/lib/exhibition";

export async function GET() {
  const authz = await requireSession();
  if ("error" in authz) return authz.error;
  const active = await getActiveExhibition();
  if (!active) {
    return NextResponse.json({ active: null });
  }
  return NextResponse.json({
    active: {
      id: active.id,
      name: active.name,
      location: active.location,
      startsAt: active.startsAt,
      endsAt: active.endsAt,
      active: active.active,
    },
  });
}
