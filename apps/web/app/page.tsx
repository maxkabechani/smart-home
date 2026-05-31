import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "./get-query-client";
import { prefetchLatestReading } from "../features/readings/actions";
import ReadingsDashboard from "../features/readings/readings-dashboard";

export default async function Home() {
  const queryClient = getQueryClient();
  await prefetchLatestReading(queryClient);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReadingsDashboard />
    </HydrationBoundary>
  );
}
