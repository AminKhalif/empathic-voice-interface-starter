import React from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

export default function ProgressPage() {
  return (
    <div className="flex flex-col min-h-screen p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6">Your Progress</h1>
      
      <div className="bg-gray-100 rounded-lg p-5 mb-8">
        <h2 className="text-xl font-bold mb-4">Weekly Stats</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Exercises Completed</p>
            <p className="text-2xl font-bold">5</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Practice Time</p>
            <p className="text-2xl font-bold">48 minutes</p>
          </div>
        </div>
      </div>

      <Link href="/" className="mt-6 inline-flex items-center text-blue-600">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Back to Home
      </Link>
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
} 