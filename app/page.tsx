import HomePage from "@/components/HomePage";
import BottomNav from '@/components/BottomNav';

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="grow">
        <HomePage />
      </div>
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
