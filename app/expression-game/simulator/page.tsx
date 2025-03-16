"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

export default function ExpressionGameSimulator() {
  const [gameState, setGameState] = useState<"idle" | "countdown" | "playing" | "success" | "failed">("idle");
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(30);
  const [joyScore, setJoyScore] = useState(0.7);
  const [joyThreshold] = useState(0.5);
  const [showWarning, setShowWarning] = useState(false);
  
  // Handle countdown
  useEffect(() => {
    if (gameState !== "countdown") return;
    
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setGameState("playing");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(countdownInterval);
  }, [gameState]);
  
  // Handle game timer
  useEffect(() => {
    if (gameState !== "playing") return;
    
    const timerInterval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          setGameState("success");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timerInterval);
  }, [gameState]);
  
  // Simulate fluctuating joy scores
  useEffect(() => {
    if (gameState !== "playing") return;
    
    const joyInterval = setInterval(() => {
      // Generate value between 0.3 and 0.9
      const baseValue = 0.7;
      const variation = (Math.random() - 0.5) * 0.4;
      const newJoy = Math.max(0, Math.min(1, baseValue + variation));
      
      setJoyScore(newJoy);
      
      // Show warning for low joy
      if (newJoy < joyThreshold) {
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 2000);
      }
    }, 1000);
    
    return () => clearInterval(joyInterval);
  }, [gameState, joyThreshold]);
  
  const startGame = () => {
    setCountdown(3);
    setGameState("countdown");
  };
  
  const resetGame = () => {
    setTimer(30);
    setJoyScore(0.7);
    setGameState("idle");
  };
  
  return (
    <div className="flex flex-col min-h-screen">
      <div className="grow flex flex-col p-4 pb-20">
        <h1 className="text-2xl font-bold mb-4">Joy Expression Game</h1>
        
        <div className="w-full max-w-md mx-auto">
          {/* Game display */}
          <div className="relative bg-gray-200 rounded-lg aspect-video flex items-center justify-center mb-6 overflow-hidden">
            {/* Simulated face */}
            <div className="text-6xl">
              {joyScore >= joyThreshold ? "😊" : "😐"}
            </div>
            
            {/* Game state overlays */}
            {gameState === "countdown" && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="text-white text-6xl font-bold">{countdown}</div>
              </div>
            )}
            
            {gameState === "success" && (
              <div className="absolute inset-0 bg-green-500/70 flex items-center justify-center">
                <div className="text-white text-2xl font-bold text-center">
                  Success!<br />Well done!
                </div>
              </div>
            )}
            
            {/* Joy score bar */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/30">
              <div className="relative h-5 bg-white/50 rounded-full overflow-hidden">
                <motion.div
                  className="absolute top-0 left-0 h-full bg-yellow-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${joyScore * 100}%` }}
                  transition={{ duration: 0.2 }}
                />
                <div 
                  className="absolute top-0 h-full w-1 bg-red-500" 
                  style={{ left: `${joyThreshold * 100}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                  Joy Score: {joyScore.toFixed(2)}
                </div>
              </div>
            </div>
            
            {/* Warning message */}
            {showWarning && (
              <div className="absolute top-2 left-0 right-0 mx-auto w-3/4 bg-yellow-500 text-black py-2 px-4 rounded-full text-center animate-pulse">
                <span className="font-bold">Smile more! 😊</span>
              </div>
            )}
          </div>
          
          {/* Timer (when playing) */}
          {gameState === "playing" && (
            <div className="mb-4 text-center">
              <div className="text-4xl font-bold">{timer}s</div>
              <p className="text-sm text-gray-600">Keep smiling!</p>
            </div>
          )}
          
          {/* Game controls */}
          <div className="mb-8">
            {gameState === "idle" && (
              <button
                onClick={startGame}
                className="block w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-center text-white font-bold rounded-lg"
              >
                Start Game
              </button>
            )}
            
            {(gameState === "success") && (
              <div className="flex flex-col gap-3">
                <div className="bg-green-100 p-4 rounded-lg text-center">
                  <p className="text-green-800 font-bold">Congratulations!</p>
                  <p className="text-sm">You successfully maintained your smile for 30 seconds.</p>
                </div>
                <button
                  onClick={resetGame}
                  className="block w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-center text-white font-bold rounded-lg"
                >
                  Play Again
                </button>
              </div>
            )}
            
            {(gameState === "countdown" || gameState === "playing") && (
              <div className="bg-gray-100 p-4 rounded-lg text-center">
                <p className="text-gray-800 font-bold">
                  {gameState === "countdown" ? "Get ready to smile!" : "Keep smiling!"}
                </p>
              </div>
            )}
            
            <div className="mt-4">
              <Link href="/expression-game" className="text-blue-600 hover:underline text-sm">
                ← Back to main screen
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
} 