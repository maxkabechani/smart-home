import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "./get-query-client";
import { prefetchLatestReading } from "../features/readings/actions";
import ReadingsDashboard from "../features/readings/readings-dashboard";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://temp.maxkabechani.dev";

export default async function Home() {
  const queryClient = getQueryClient();
  await prefetchLatestReading(queryClient);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ESP32 Monitor",
    url: siteUrl,
    description: "Live temperature and humidity readings from ESP32 sensors.",
  };

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ReadingsDashboard />
    </HydrationBoundary>
  );
}
