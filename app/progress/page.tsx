'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ProgressPage() {
  const [progressData, setProgressData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{role: string, content: string}>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch progress data
  useEffect(() => {
    const fetchProgressData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/progress');
        
        if (!response.ok) {
          throw new Error('Failed to fetch progress data');
        }
        
        const data = await response.json();
        setProgressData(data);
        
        // Check if this is demo data by looking for demo IDs
        if (data.recentSessions && data.recentSessions.some((session: any) => 
          session.id && session.id.toString().startsWith('demo-'))) {
          setIsDemo(true);
        }
        
        if (debugMode) {
          console.log('Progress data received:', data);
        }
      } catch (err) {
        console.error('Error fetching progress data:', err);
        setError('Failed to load your progress data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProgressData();
  }, [debugMode]);

  // Scroll to bottom of chat when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Format minutes and seconds
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sec`;
  };

  // Send message to chat API
  const sendMessage = async () => {
    if (!currentMessage.trim()) return;
    
    // Add user message to chat
    const userMessage = { role: 'user', content: currentMessage };
    setChatMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setChatLoading(true);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: currentMessage,
          debug: debugMode 
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (debugMode) {
        console.log('Chat API response:', data);
      }
      
      // Check if the response indicates demo data
      if (data.isDemo) {
        setIsDemo(true);
      }
      
      // Check if there's an error in the response
      if (data.error) {
        console.error('Error from chat API:', data.error);
        // Still show the response if one was provided
        if (data.response) {
          setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } else {
          setChatMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'I encountered an error processing your request. Please try again or rephrase your question.' 
          }]);
        }
      } else {
        // Add assistant response to chat
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      
      // Add error message to chat
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologize, but I encountered a technical issue. Please try again or check your connection.' 
      }]);
      
      // If in debug mode, add more detailed error info
      if (debugMode) {
        setChatMessages(prev => [...prev, { 
          role: 'system', 
          content: `Debug info: ${err instanceof Error ? err.message : String(err)}` 
        }]);
      }
    } finally {
      setChatLoading(false);
    }
  };

  // Handle enter key in chat input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Welcome message when chat is empty
  useEffect(() => {
    if (chatMessages.length === 0 && progressData) {
      setChatMessages([
        { 
          role: 'assistant', 
          content: 'Hello! I can help you understand your voice therapy progress. You can ask me questions like "How is my voice stability improving?" or "What can I do to improve my voice strength?"' 
        }
      ]);
    }
  }, [progressData, chatMessages.length]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen p-4 pb-20 items-center justify-center">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading your progress data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen p-4 pb-20">
        <h1 className="text-2xl font-bold mb-6">Your Progress</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
          <button 
            className="mt-2 bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
        <Link href="/" className="mt-6 inline-flex items-center text-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back to Home
        </Link>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6">Your Voice Therapy Progress</h1>
      
      {isDemo && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">You're viewing demo data.</p>
              <p className="text-sm">Sign in and complete voice exercises to see your actual progress.</p>
            </div>
            <Link href="/login" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
              Sign In
            </Link>
          </div>
        </div>
      )}
      
      {/* Debug mode toggle - only visible in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 flex items-center">
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={debugMode} 
                onChange={() => setDebugMode(!debugMode)} 
              />
              <div className={`block w-10 h-6 rounded-full ${debugMode ? 'bg-green-400' : 'bg-gray-300'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${debugMode ? 'transform translate-x-4' : ''}`}></div>
            </div>
            <div className="ml-3 text-sm font-medium text-gray-700">
              Debug Mode {debugMode ? 'On' : 'Off'}
            </div>
          </label>
          {debugMode && (
            <button 
              onClick={() => console.log('Current progress data:', progressData)} 
              className="ml-4 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
            >
              Log Data
            </button>
          )}
        </div>
      )}
      
      {progressData && (
        <>
          {/* Weekly Stats */}
          <div className="bg-white rounded-lg p-5 mb-6 shadow">
            <h2 className="text-xl font-bold mb-4">Weekly Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Exercises Completed</p>
                <p className="text-2xl font-bold">{progressData.weeklyStats.exercisesCompleted}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Practice Time</p>
                <p className="text-2xl font-bold">{formatTime(progressData.weeklyStats.totalPracticeTime)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Voice Strength</p>
                <p className="text-2xl font-bold">{progressData.weeklyStats.averageVoiceStrength.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Voice Stability</p>
                <p className="text-2xl font-bold">{progressData.weeklyStats.averageVoiceStability.toFixed(1)}</p>
              </div>
            </div>
          </div>
          
          {/* Progress Charts */}
          {progressData.recentSessions.length > 0 && (
            <div className="bg-white rounded-lg p-5 mb-6 shadow">
              <h2 className="text-xl font-bold mb-4">Progress Over Time</h2>
              
              <div className="mb-6">
                <h3 className="text-md font-semibold mb-2">Voice Strength</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={progressData.recentSessions.slice().reverse()}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value: string) => new Date(value).toLocaleDateString()}
                        formatter={(value: number) => [Number(value).toFixed(1), 'Voice Strength']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="averageVoiceStrength" 
                        stroke="#8884d8" 
                        activeDot={{ r: 8 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div>
                <h3 className="text-md font-semibold mb-2">Voice Stability</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={progressData.recentSessions.slice().reverse()}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value: string) => new Date(value).toLocaleDateString()}
                        formatter={(value: number) => [Number(value).toFixed(1), 'Voice Stability']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="voiceStability" 
                        stroke="#82ca9d" 
                        activeDot={{ r: 8 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
          
          {/* Chat with AI Assistant */}
          <div className="bg-white rounded-lg p-5 mb-6 shadow">
            <h2 className="text-xl font-bold mb-4">Chat with Your Voice Therapy Assistant</h2>
            
            <div className="border rounded-lg mb-4">
              <div className="h-80 overflow-y-auto p-4 bg-gray-50">
                {chatMessages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`mb-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                  >
                    <div 
                      className={`inline-block rounded-lg px-4 py-2 max-w-[80%] ${
                        msg.role === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : msg.role === 'system'
                            ? 'bg-gray-200 text-xs font-mono' 
                            : 'bg-white border border-gray-200'
                      }`}
                    >
                      {msg.content}
                      
                      {/* Add retry button for assistant errors */}
                      {msg.role === 'assistant' && 
                       msg.content.includes('error') && 
                       msg.content.includes('try again') && 
                       index === chatMessages.length - 1 && (
                        <button 
                          onClick={() => {
                            // Find the last user message
                            const lastUserMsgIndex = [...chatMessages].reverse()
                              .findIndex(m => m.role === 'user');
                            if (lastUserMsgIndex >= 0) {
                              const lastUserMsg = chatMessages[chatMessages.length - 1 - lastUserMsgIndex];
                              // Remove the error message and retry
                              setChatMessages(prev => prev.slice(0, -1));
                              setCurrentMessage(lastUserMsg.content);
                              setTimeout(() => sendMessage(), 100);
                            }
                          }}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                        >
                          Retry this question
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="text-left mb-3">
                    <div className="inline-block rounded-lg px-4 py-2 bg-gray-200 text-gray-800">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              
              <div className="flex p-2 border-t">
                <textarea
                  className="flex-grow px-3 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ask about your progress..."
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r-lg"
                  onClick={sendMessage}
                  disabled={chatLoading}
                >
                  Send
                </button>
              </div>
            </div>
            
            <div className="text-xs text-gray-500">
              <p>This AI assistant can help you understand your progress and provide tips for improvement. Your conversation is private and secure.</p>
            </div>
          </div>
        </>
      )}

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