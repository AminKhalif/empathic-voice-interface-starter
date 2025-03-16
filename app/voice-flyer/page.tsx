'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useVoice, VoiceProvider } from "@humeai/voice-react";

// Wrapper component that provides the voice context
export default function VoiceFlyerGame() {
  // Get API key for authentication
  const apiKey = "pwAINc5tzUHCuzWj6ABMXxxGHlTUfNGnAc4yiTJvdTz89omW";
  
  return (
    <VoiceProvider
      auth={{
        type: "apiKey",
        value: apiKey
      }}
    >
      <VoiceFlyerGameContent />
    </VoiceProvider>
  );
}

// Main game component that uses voice hooks
function VoiceFlyerGameContent() {
  const { status, isMuted, unmute, mute, micFft } = useVoice();
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [ballPosition, setBallPosition] = useState(50);
  const [obstacles, setObstacles] = useState<Array<{id: number, position: number, passed: boolean}>>([]);
  const [currentDecibel, setCurrentDecibel] = useState(0);
  const [targetDecibel, setTargetDecibel] = useState(50); // Medium level target
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 second countdown
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const obstacleIdRef = useRef(0);
  
  // Convert the microphone FFT data to an approximate decibel value (0-100 scale)
  useEffect(() => {
    if (micFft && micFft.length > 0) {
      // Average the first few values from the FFT data for a rough volume estimate
      const avgValue = micFft.slice(0, 8).reduce((sum, val) => sum + val, 0) / 8;
      // Scale to 0-100 range for easier display
      const scaledValue = Math.min(Math.max(avgValue * 25, 0), 100);
      setCurrentDecibel(Math.round(scaledValue));
      
      if (gameActive) {
        // Update ball position based on voice volume
        setBallPosition(100 - scaledValue);
      }
    }
  }, [micFft, gameActive]);
  
  // Game loop
  useEffect(() => {
    if (gameActive) {
      if (isMuted) {
        unmute();
      }
      
      // Start the game loop
      gameLoopRef.current = setInterval(() => {
        // Move obstacles from right to left
        setObstacles(prev => {
          // Move existing obstacles
          const updatedObstacles = prev
            .map(obs => ({
              ...obs,
              position: obs.position - 2, // Speed of obstacles
            }))
            .filter(obs => obs.position > -10); // Remove obstacles that have gone off-screen
          
          // Check for collisions and scoring
          let scoreIncrement = 0;
          updatedObstacles.forEach(obs => {
            // If obstacle is at the ball's x-position (approx center of screen)
            if (obs.position <= 52 && obs.position >= 48 && !obs.passed) {
              // Mark as passed
              obs.passed = true;
              
              // Check if ball is within the gap
              const gapTop = 60; // Top of the gap
              const gapBottom = 40; // Bottom of the gap
              if (ballPosition >= gapBottom && ballPosition <= gapTop) {
                // Successfully navigated through the gap
                scoreIncrement += 10;
              }
            }
          });
          
          // Add score if earned
          if (scoreIncrement > 0) {
            setScore(prev => {
              const newScore = prev + scoreIncrement;
              // Update best score if needed
              if (newScore > bestScore) {
                setBestScore(newScore);
              }
              return newScore;
            });
          }
          
          // Add new obstacles randomly
          if (Math.random() < 0.02) { // 2% chance per frame to add a new obstacle
            const newId = obstacleIdRef.current++;
            updatedObstacles.push({
              id: newId,
              position: 100, // Start from the right edge
              passed: false,
            });
          }
          
          return updatedObstacles;
        });
      }, 50); // 20 FPS game loop
      
      // Start the 30-second timer
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            // End game when timer reaches 0
            endGame();
            return 0;
          }
          return newTime;
        });
      }, 1000);
      
      return () => {
        if (gameLoopRef.current) {
          clearInterval(gameLoopRef.current);
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [gameActive, isMuted, unmute, bestScore]);
  
  // Start the game
  const startGame = () => {
    setGameActive(true);
    setScore(0);
    setObstacles([]);
    setTimeRemaining(30);
    unmute();
  };
  
  // End the game
  const endGame = () => {
    setGameActive(false);
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Update best score if needed
    if (score > bestScore) {
      setBestScore(score);
    }
  };
  
  // Set difficulty which changes the target decibel level
  const setDifficulty = (level: 'easy' | 'medium' | 'hard') => {
    switch (level) {
      case 'easy':
        setTargetDecibel(30);
        break;
      case 'medium':
        setTargetDecibel(50);
        break;
      case 'hard':
        setTargetDecibel(70);
        break;
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-4">
      <div className="flex justify-between items-center mb-4">
        <Link href="/" className="text-sm flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back
        </Link>
        <h1 className="text-xl font-bold">Voice Flyer Game</h1>
        <div className="w-[24px]"></div> {/* Empty div for flexbox alignment */}
      </div>
      
      <div className="max-w-md mx-auto w-full bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-center font-bold">Voice Flyer</h2>
          <p className="text-center text-sm text-gray-600">
            Control the ball with your voice! Speak louder to fly higher.
          </p>
          
          <div className="flex justify-between items-center mt-4">
            <div>Score: {score}</div>
            <div className={`font-bold ${timeRemaining <= 5 ? 'text-red-500' : ''}`}>
              Time: {timeRemaining}s
            </div>
            <div>Best: {bestScore}</div>
          </div>
        </div>
        
        <div className="bg-blue-50 relative h-[300px] overflow-hidden">
          {/* Ball */}
          <motion.div 
            className="absolute left-[50%] w-8 h-8 rounded-full bg-red-500"
            animate={{ 
              y: `${ballPosition}%`,
              x: "-50%",
              transition: { type: "spring", stiffness: 200, damping: 20 }
            }}
          />
          
          {/* Obstacles */}
          {obstacles.map(obstacle => (
            <div key={obstacle.id} className="absolute top-0 h-full" style={{ left: `${obstacle.position}%` }}>
              <div className="w-4 bg-gray-800 h-[40%]" />
              <div className="w-4 h-[20%]" /> {/* Gap */}
              <div className="w-4 bg-gray-800 h-[40%]" />
            </div>
          ))}
          
          {/* Center line */}
          <div className="absolute left-0 top-[50%] w-full border-t border-dashed border-gray-300" />
          
          {/* Current decibel indicator */}
          <div className="absolute right-2 top-2 bg-white/80 p-2 rounded text-sm">
            Volume: {currentDecibel}dB
          </div>
          
          {/* Target indicator */}
          <div className="absolute right-2 bottom-2 bg-white/80 p-2 rounded text-sm">
            Target: {targetDecibel}dB
          </div>
          
          {/* Game over or start message */}
          {!gameActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="bg-white p-4 rounded-lg text-center">
                <h3 className="font-bold mb-2">
                  {score > 0 ? 'Game Over!' : 'Ready to Start?'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {score > 0 
                    ? `Your score: ${score}`
                    : 'Keep your voice at the target level. 30 seconds per session.'
                  }
                </p>
                <button 
                  onClick={startGame}
                  className="bg-green-500 text-white px-4 py-2 rounded"
                >
                  {score > 0 ? 'Play Again' : 'Start Game'}
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t">
          <h3 className="font-medium mb-2">How to play:</h3>
          <ul className="space-y-1 text-sm">
            <li>• Speak continuously to control the ball</li>
            <li>• Speak louder to make the ball go up</li>
            <li>• Speak softer to let the ball go down</li>
            <li>• Navigate through the gaps in the obstacles</li>
            <li>• Each obstacle passed gives you 10 points</li>
            <li>• Each session lasts exactly 30 seconds</li>
          </ul>
          
          <div className="mt-4">
            <h3 className="font-medium mb-2">Difficulty Level:</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setDifficulty('easy')}
                className={`px-3 py-1 text-sm rounded ${targetDecibel === 30 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Easy
              </button>
              <button 
                onClick={() => setDifficulty('medium')}
                className={`px-3 py-1 text-sm rounded ${targetDecibel === 50 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Medium
              </button>
              <button 
                onClick={() => setDifficulty('hard')}
                className={`px-3 py-1 text-sm rounded ${targetDecibel === 70 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Hard
              </button>
            </div>
          </div>
          
          <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-sm font-bold flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Voice Therapy Benefits
            </h3>
            <p className="text-xs mt-1">This game helps strengthen your voice by encouraging you to:</p>
            <ul className="text-xs mt-2 space-y-1">
              <li>• Maintain continuous phonation (sustained voice)</li>
              <li>• Practice volume control</li>
              <li>• Develop breath support for speech</li>
              <li>• Have fun while doing your voice exercises!</li>
            </ul>
          </div>
          
          {gameActive && (
            <button 
              onClick={endGame}
              className="w-full mt-4 px-4 py-2 bg-red-100 text-red-800 rounded"
            >
              End Game
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 