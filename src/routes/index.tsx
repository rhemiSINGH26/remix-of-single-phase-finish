import { createFileRoute } from "@tanstack/react-router";
import Workspace from "@/components/sentinel/Workspace";

export const Route = createFileRoute("/")({
  component: Workspace,
  head: () => ({
    meta: [
      { title: "SENTINEL · Video intelligence" },
      {
        name: "description",
        content: "Search surveillance video conversationally, monitor a live CCTV matrix, register cameras and trace identities across feeds.",
      },
      { property: "og:title", content: "SENTINEL · Video intelligence" },
      {
        property: "og:description",
        content: "Search surveillance video conversationally, monitor a live CCTV matrix, register cameras and trace identities across feeds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
