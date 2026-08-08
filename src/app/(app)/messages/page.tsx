import { redirect } from "next/navigation";

/** السجل يُفتح من تبويبي الدعوة والاستبيان — لا صفحة قائمة منفصلة */
export default function MessagesPage() {
  redirect("/invites");
}
