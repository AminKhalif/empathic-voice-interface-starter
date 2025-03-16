"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BottomNav = () => {
  const pathname = usePathname();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 pt-2 pb-1 flex justify-between items-center border-t bg-white dark:bg-gray-900 dark:border-gray-800">
      <Link href="/" className={`flex flex-col items-center p-3 ${pathname === '/' ? 'text-blue-600' : ''}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span className="text-xs">Home</span>
      </Link>
      <Link href="/progress" className={`flex flex-col items-center p-3 ${pathname === '/progress' ? 'text-blue-600' : ''}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"></path>
          <path d="m19 9-5 5-4-4-3 3"></path>
        </svg>
        <span className="text-xs">Progress</span>
      </Link>
      <Link href="/chat" className={`flex flex-col items-center p-3 ${pathname === '/chat' ? 'text-blue-600' : ''}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="10" r="3"></circle>
          <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path>
        </svg>
        <span className="text-xs">Profile</span>
      </Link>
    </nav>
  );
};

export default BottomNav; 