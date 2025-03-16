import { getHumeAccessToken } from "@/utils/getHumeAccessToken";
import dynamic from "next/dynamic";
import BottomNav from '@/components/BottomNav';

const Chat = dynamic(() => import("@/components/Chat"), {
  ssr: false,
});

export default async function ChatPage() {
  const accessToken = await getHumeAccessToken();

  if (!accessToken) {
    throw new Error();
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="grow flex flex-col pb-20">
        <Chat accessToken={accessToken} />
      </div>
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
} 