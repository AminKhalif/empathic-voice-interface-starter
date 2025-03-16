import React from 'react';
import Link from 'next/link';
import BottomNav from './BottomNav';

const HomePage = () => {
  return (
    <div className="flex flex-col min-h-screen p-4 pb-20">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">VoiceStrong</h1>
        <button className="p-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </header>

      {/* Welcome Message */}
      <h2 className="text-3xl font-bold text-center mb-8">Welcome Back!</h2>

      {/* Today's Goal */}
      <div className="bg-gray-100 rounded-lg p-5 mb-8">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg">Today's Goal</h3>
          <div className="bg-gray-200 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8"></path>
              <path d="M12 17v4"></path>
              <path d="M12 13a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"></path>
            </svg>
          </div>
        </div>
        <h2 className="text-3xl font-bold mb-4">3 Exercises</h2>
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div className="bg-black rounded-full h-3" style={{ width: '33%' }}></div>
        </div>
        <p className="text-sm">1 of 3 completed</p>
      </div>

      {/* Voice Exercises */}
      <h3 className="text-2xl font-bold mb-4">Voice Exercises</h3>
      
      <div className="space-y-4">
        {/* Voice Flyer Game */}
        <Link href="/voice-flyer">
          <div className="border border-green-200 bg-green-50 rounded-lg p-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.5 10.5 8 12l2.5 1.5v-3Z"></path>
                  <path d="M16 10.13c.97.68 1.64 1.83 1.64 3.15 0 2.08-1.64 3.76-3.64 3.76-2 0-3.64-1.68-3.64-3.76 0-1.32.67-2.47 1.64-3.15"></path>
                  <path d="M18 8a4 4 0 0 0-4.39-3.97c-2.2.14-3.94 1.93-4 4.14-.06 2.02 1.24 3.88 3.14 4.61"></path>
                  <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                </svg>
              </div>
              <div>
                <div className="flex items-center">
                  <h4 className="font-bold mr-2">Voice Flyer Game</h4>
                  <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">NEW!</span>
                </div>
                <p className="text-sm text-gray-600">Control a flying ball with your voice!</p>
              </div>
            </div>
            <span className="text-green-600 font-bold">0</span>
          </div>
        </Link>

        {/* Sustained Vowels */}
        <div className="border rounded-lg p-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" x2="12" y1="19" y2="22"></line>
              </svg>
            </div>
            <div>
              <h4 className="font-bold">Sustained Vowels</h4>
              <p className="text-sm text-gray-600">Hold your voice loud and strong</p>
            </div>
          </div>
          <span className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full">1</span>
        </div>

        {/* Pitch Glides */}
        <div className="border rounded-lg p-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"></path>
                <path d="m19 9-5 5-4-4-3 3"></path>
              </svg>
            </div>
            <div>
              <h4 className="font-bold">Pitch Glides</h4>
              <p className="text-sm text-gray-600">Practice vocal range with fun</p>
            </div>
          </div>
          <span className="text-gray-600 font-bold">0</span>
        </div>

        {/* Functional Phrases */}
        <div className="border rounded-lg p-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <line x1="9" x2="9.01" y1="9" y2="9"></line>
                <line x1="15" x2="15.01" y1="9" y2="9"></line>
              </svg>
            </div>
            <div>
              <h4 className="font-bold">Functional Phrases</h4>
              <p className="text-sm text-gray-600">Practice everyday speaking</p>
            </div>
          </div>
          <span className="text-gray-600 font-bold">0</span>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default HomePage; 