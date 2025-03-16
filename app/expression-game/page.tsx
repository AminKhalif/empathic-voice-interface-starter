import { getHumeAccessToken } from "@/utils/getHumeAccessToken";
import dynamic from "next/dynamic";
import BottomNav from '@/components/BottomNav';

// Dynamic import the camera component with no server-side rendering
const SimpleExpressionGame = dynamic(() => import("@/components/SimpleExpressionGame"), {
  ssr: false,
});

export default async function ExpressionGamePage() {
  // Get the access token for Hume API
  const accessToken = await getHumeAccessToken();

  return (
    <div className="flex flex-col min-h-screen">
      <div className="grow flex flex-col pb-20">
        <SimpleExpressionGame accessToken={accessToken || ""} />
      </div>
      
      <BottomNav />
    </div>
  );
} 