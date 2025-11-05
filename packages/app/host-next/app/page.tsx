import dynamic from "next/dynamic";

const HostStudio = dynamic(() => import("./components/HostStudio"), { ssr: false });

export default function Page() {
  return <HostStudio />;
}

