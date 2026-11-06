import { createFileRoute } from "@tanstack/react-router";
import { HelmsDeepGame } from "@/components/HelmsDeepGame";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <HelmsDeepGame />;
}
