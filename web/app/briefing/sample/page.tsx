import { BriefingPage } from "@/components/briefing-page";
import { loadOperationalBriefing } from "@/lib/briefing-data";

export default async function SampleBriefingPage() {
  return <BriefingPage briefing={await loadOperationalBriefing("sample")} />;
}
