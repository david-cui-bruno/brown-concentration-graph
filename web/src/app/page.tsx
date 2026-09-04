import dynamic from "next/dynamic";

const GraphView = dynamic(() => import("@/components/GraphView"), { ssr: false });

export default function Home() {
  return <GraphView />;
}
