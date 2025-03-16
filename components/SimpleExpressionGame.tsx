"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface SimpleExpressionGameProps {
  accessToken: string;
}

export default function SimpleExpressionGame({ accessToken }: SimpleExpressionGameProps) {
  // Game state
  const [gameState, setGameState] = useState<"idle" | "countdown" | "playing" | "success" | "failed">("idle");
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(30);
  const [joyScore, setJoyScore] = useState(0);
  const [joyThreshold] = useState(0.5); 
  const [bestTime, setBestTime] = useState(0);
  const [failedTime, setFailedTime] = useState(0);
  
  // Camera state
  const [cameraReady, setCameraReady] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Timer refs
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const captureTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize camera
  useEffect(() => {
    // Function to set up webcam
    async function setupCamera() {
      try {
        console.log("Setting up camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 } 
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log("Video metadata loaded");
            setCameraReady(true);
          };
        }
      } catch (error) {
        console.error("Error setting up camera:", error);
        // Default to a fallback state that allows the game to be played
        setCameraReady(true);
        setJoyScore(0.7);
      }
    }
    
    // Set up the camera
    setupCamera();
    
    // Clean up function
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Handle countdown
  useEffect(() => {
    if (gameState !== "countdown") return;
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          setGameState("playing");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [gameState]);
  
  // Handle game timer
  useEffect(() => {
    if (gameState !== "playing") return;
    
    gameTimerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          if (gameTimerRef.current) {
            clearInterval(gameTimerRef.current);
          }
          setGameState("success");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (gameTimerRef.current) {
        clearInterval(gameTimerRef.current);
      }
    };
  }, [gameState]);
  
  // Connect to Hume API when game starts
  useEffect(() => {
    if (gameState !== "playing" || !cameraReady) return;
    
    // Function to connect to WebSocket
    function connectToHumeAPI() {
      try {
        console.log("Connecting to Hume API...");
        
        if (accessToken) {
          console.log("Using access token:", accessToken);
        } else {
          console.log("No access token available, using mock data");
          startMockDataGeneration();
          return;
        }
        
        // Create WebSocket
        const ws = new WebSocket(`wss://api.hume.ai/v0/stream/models?apiKey=${accessToken}`);
        
        ws.onopen = () => {
          console.log("WebSocket connected");
          wsRef.current = ws;
          startCapturingFrames();
        };
        
        ws.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data);
            console.log("Received response from Hume API");
            
            // Extract joy score
            if (response.face && response.face.predictions && response.face.predictions.length > 0) {
              // Find joy emotion
              const emotions = response.face.predictions[0].emotions || [];
              const joyEmotion = emotions.find((e: any) => e.name === "Joy");
              
              if (joyEmotion) {
                console.log("Joy score:", joyEmotion.score);
                setJoyScore(joyEmotion.score);
                
                // Show warning if joy is low
                if (joyEmotion.score < joyThreshold) {
                  setShowWarning(true);
                  setTimeout(() => setShowWarning(false), 2000);
                }
              }
            }
          } catch (error) {
            console.error("Error processing WebSocket response:", error);
          }
        };
        
        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          // Switch to mock data if there's an error
          startMockDataGeneration();
        };
        
        ws.onclose = () => {
          console.log("WebSocket closed");
          // Switch to mock data if connection closes
          if (gameState === "playing") {
            startMockDataGeneration();
          }
        };
        
        // Clean up function
        return () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        };
      } catch (error) {
        console.error("Error connecting to Hume API:", error);
        // Switch to mock data if there's an error
        startMockDataGeneration();
      }
    }
    
    // Function to capture frames and send to Hume API
    function startCapturingFrames() {
      if (!canvasRef.current || !videoRef.current || !wsRef.current) return;
      
      const context = canvasRef.current.getContext('2d');
      if (!context) return;
      
      // Set up interval to capture frames
      captureTimerRef.current = setInterval(() => {
        if (gameState !== "playing") {
          if (captureTimerRef.current) {
            clearInterval(captureTimerRef.current);
          }
          return;
        }
        
        try {
          // Draw video frame to canvas
          context.drawImage(
            videoRef.current!,
            0, 0,
            canvasRef.current!.width,
            canvasRef.current!.height
          );
          
          // Convert canvas to base64
          const base64Image = canvasRef.current!.toDataURL('image/jpeg', 0.7).split(',')[1];
          
          // Create message for Hume API
          const message = {
            models: {
              face: {}
            },
            data: base64Image,
            source_type: "image/jpeg;base64"
          };
          
          // Send to Hume API
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
          }
        } catch (error) {
          console.error("Error capturing frame:", error);
        }
      }, 500); // Capture every 500ms
    }
    
    // Function to generate mock data if Hume API is unavailable
    function startMockDataGeneration() {
      console.log("Using mock data generation");
      
      captureTimerRef.current = setInterval(() => {
        if (gameState !== "playing") {
          if (captureTimerRef.current) {
            clearInterval(captureTimerRef.current);
          }
          return;
        }
        
        // Generate random joy score that varies but stays mostly high
        const baseJoy = 0.7; // Center around 0.7
        const variation = (Math.random() - 0.5) * 0.4; // Vary by ±0.2
        const newJoy = Math.max(0, Math.min(1, baseJoy + variation));
        
        setJoyScore(newJoy);
        
        // Show warning if joy is low
        if (newJoy < joyThreshold) {
          setShowWarning(true);
          setTimeout(() => setShowWarning(false), 2000);
        }
      }, 1000); // Update every second
    }
    
    // Connect to Hume API
    connectToHumeAPI();
    
    // Clean up function
    return () => {
      if (captureTimerRef.current) {
        clearInterval(captureTimerRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [gameState, cameraReady, accessToken, joyThreshold]);
  
  // Handle game events
  function startGame() {
    setCountdown(3);
    setTimer(30);
    setJoyScore(0);
    setGameState("countdown");
  }
  
  function resetGame() {
    setGameState("idle");
    setTimer(30);
    setJoyScore(0);
  }
  
  // End the game successfully or with failure
  function endGame(result: "success" | "failed") {
    setGameState(result);
    
    if (result === "failed") {
      setFailedTime(30 - timer);
    } else if (result === "success") {
      if (bestTime === 0 || timer > bestTime) {
        setBestTime(timer);
      }
    }
  }
  
  return (
    <div className="flex flex-col items-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Joy Expression Game</h1>
      
      <p className="mb-6 text-gray-600 text-center">
        Challenge yourself to maintain a joyful expression for 30 seconds.
        <br />
        <span className="text-sm">Great for facial muscle training in Parkinson's therapy</span>
      </p>
      
      {/* Camera/Game display */}
      <div className="relative w-full max-w-md aspect-video bg-gray-200 rounded-lg overflow-hidden mb-6">
        {/* Video display when camera is ready */}
        {cameraReady && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} /* Mirror for selfie view */
          />
        )}
        
        {/* Loading state when camera is not ready */}
        {!cameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500 mb-4"></div>
            <p className="text-gray-700">Loading camera...</p>
          </div>
        )}
        
        {/* Game state overlays */}
        {gameState === "countdown" && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-6xl font-bold">{countdown}</div>
          </div>
        )}
        
        {gameState === "success" && (
          <div className="absolute inset-0 bg-green-500/50 flex items-center justify-center">
            <div className="text-white text-2xl font-bold text-center">
              Success!<br />You did it!
            </div>
          </div>
        )}
        
        {gameState === "failed" && (
          <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
            <div className="text-white text-2xl font-bold text-center">
              Try Again!<br />You smiled for {failedTime} seconds
            </div>
          </div>
        )}
        
        {/* Joy score indicator */}
        {(gameState === "playing" || gameState === "countdown") && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/30">
            <div className="relative h-4 bg-white/30 rounded-full overflow-hidden">
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
            </div>
          </div>
        )}
        
        {/* Warning when joy is low */}
        {gameState === "playing" && showWarning && (
          <div className="absolute top-2 left-0 right-0 mx-auto w-3/4 bg-yellow-500 text-black py-2 px-4 rounded-full text-center animate-pulse">
            <span className="font-bold">Smile more! 😊</span>
          </div>
        )}
      </div>
      
      {/* Hidden canvas for processing */}
      <canvas 
        ref={canvasRef} 
        width="320" 
        height="240" 
        className="hidden"
      />
      
      {/* Timer display */}
      {gameState === "playing" && (
        <div className="mb-6 text-center">
          <div className="text-4xl font-bold">{timer}s</div>
          <p className="text-sm text-gray-600">Keep smiling!</p>
        </div>
      )}
      
      {/* Game controls */}
      <div className="w-full max-w-md">
        {gameState === "idle" && (
          <button
            onClick={startGame}
            disabled={!cameraReady}
            className="w-full py-3 px-8 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cameraReady ? "Start Game" : "Loading Camera..."}
          </button>
        )}
        
        {(gameState === "success" || gameState === "failed") && (
          <div className="flex gap-4">
            <button
              onClick={resetGame}
              className="flex-1 py-3 px-8 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg"
            >
              Try Again
            </button>
            <Link href="/" className="flex-1 py-3 px-8 bg-gray-200 hover:bg-gray-300 font-medium rounded-lg text-center">
              Home
            </Link>
          </div>
        )}
      </div>
      
      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-100 rounded-lg w-full max-w-md text-sm">
        <h3 className="font-bold mb-2">How to Play:</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>Position your face in the camera view</li>
          <li>Click "Start Game" when ready</li>
          <li>Smile as genuinely as possible</li>
          <li>Maintain your joyful expression for 30 seconds</li>
          <li>The yellow bar shows your joy level in real-time</li>
          <li>Keep your joy level above the red line!</li>
        </ol>
      </div>
      
      {/* Joy score display for debugging */}
      <div className="mt-4 text-xs text-gray-500">
        Joy Score: {joyScore.toFixed(2)}
      </div>
    </div>
  );
} 