import dynamic from "next/dynamic";

const HomePage = dynamic(() => import("@/components/HomePage"), {
  ssr: true,
});

export default function Page() {
  return <HomePage />;
}
