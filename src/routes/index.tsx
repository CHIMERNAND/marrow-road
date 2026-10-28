import { createFileRoute } from "@tanstack/react-router";
import { MarrowRoad } from "@/components/MarrowRoad";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <MarrowRoad />;
}
