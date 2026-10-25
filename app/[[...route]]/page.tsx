import Workspace from "../../components/workspace";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ route?: string[] }>;
}) {
  const { route = [] } = await params;
  const path = "/" + route.join("/");
  if (
    ![
      "/",
      "/planner",
      "/purchases",
      "/history",
      "/import",
      "/settings",
      "/people/thiranji",
      "/people/oshadha",
      "/people/ayesh",
      "/people/supun",
    ].includes(path)
  )
    notFound();
  return <Workspace />;
}
