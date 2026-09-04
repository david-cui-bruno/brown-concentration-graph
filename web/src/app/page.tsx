import dynamic from "next/dynamic";

const GraphView = dynamic(() => import("@/components/GraphView3D"), { ssr: false });

export default function Home() {
  return <GraphView />;
}
