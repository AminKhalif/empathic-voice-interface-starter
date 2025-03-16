'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useVoice, VoiceProvider } from '@humeai/voice-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

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
  const { status, isMuted, unmute, mute, micFft, connect } = useVoice();
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [sensitivity, setSensitivity] = useState<number>(25); // Default sensitivity
  const [noiseFloor, setNoiseFloor] = useState<number>(0);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [ballPosition, setBallPosition] = useState<number>(50);
  const [currentDecibel, setCurrentDecibel] = useState<number>(0);
  const [targetDecibel, setTargetDecibel] = useState(50); // Medium level target
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 second countdown
  const [isMobile, setIsMobile] = useState(false);
  const [useNativeMic, setUseNativeMic] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [obstacles, setObstacles] = useState<Array<{id: number, position: number, passed: boolean}>>([]);
  
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const obstacleIdRef = useRef(0);
  const volumeHistoryRef = useRef<number[]>([]);
  const targetBallPositionRef = useRef<number>(50); // Target position for smooth movement
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const keepMonitoringRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const ballAnimationRef = useRef<number | null>(null);
  
  // Check browser compatibility
  const checkBrowserCompatibility = () => {
    const compatibility = {
      audioContext: !!(window.AudioContext || (window as any).webkitAudioContext),
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    };
    
    return {
      isCompatible: compatibility.audioContext && compatibility.getUserMedia,
      features: compatibility
    };
  };
  
  // Detect if user is on mobile device (iPhone)
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(userAgent);
      setIsMobile(isMobileDevice);
      
      // Adjust sensitivity based on device
      if (isMobileDevice) {
        setSensitivity(35); // Higher sensitivity for mobile devices
        
        // iOS requires user interaction before audio can start
        if (/iPhone|iPad|iPod/i.test(userAgent)) {
          document.addEventListener('touchstart', initAudioOnUserInteraction, { once: true });
        }
      } else {
        setSensitivity(25); // Default for desktop (Mac)
      }
    };
    
    checkMobile();
    
    // Check if browser supports required audio features
    const { isCompatible } = checkBrowserCompatibility();
    if (!isCompatible) {
      alert("Your browser may not fully support audio features required for this game. Please try using Chrome, Firefox, or Safari.");
    }
  }, []);
  
  // Initialize audio on user interaction (for iOS)
  const initAudioOnUserInteraction = () => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      audioContextRef.current.resume().then(() => {
        console.log("AudioContext initialized on user interaction");
      });
    }
  };
  
  // Calibrate microphone to handle different environments
  const calibrateMicrophone = () => {
    if (!useNativeMic || !analyserRef.current) return;
    
    setIsCalibrating(true);
    const calibrationSamples: number[] = [];
    
    // Collect background noise for 2 seconds
    const sampleInterval = setInterval(() => {
      if (calibrationSamples.length >= 20) {
        clearInterval(sampleInterval);
        
        // Calculate noise floor (average background noise)
        const avgNoiseFloor = calibrationSamples.reduce((sum, val) => sum + val, 0) / 
                             calibrationSamples.length;
        
        // Set threshold slightly above noise floor
        setNoiseFloor(Math.max(avgNoiseFloor + 5, 5));
        setIsCalibrating(false);
        console.log("Microphone calibrated. Noise floor:", avgNoiseFloor);
      } else if (currentDecibel) {
        calibrationSamples.push(currentDecibel);
      }
    }, 100);
    
    return () => clearInterval(sampleInterval);
  };
  
  // Initialize native microphone as fallback
  const initializeNativeMicrophone = async () => {
    try {
      // Create audio context if not already created
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      } else {
        // Resume context if it was suspended
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      }
      
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // If there's an existing stream, stop all tracks
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      micStreamRef.current = stream;
      
      // Create analyser node
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Connect microphone to analyser
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyser);
      
      setMicPermissionGranted(true);
      setUseNativeMic(true);
      console.log("Native microphone initialized successfully");
      
      // Start monitoring volume
      startMonitoringVolume();
      
      // Calibrate microphone
      calibrateMicrophone();
      
      return true;
    } catch (error) {
      console.error("Error initializing native microphone:", error);
      return false;
    }
  };
  
  // Start monitoring volume using native microphone
  const startMonitoringVolume = () => {
    if (!analyserRef.current || !useNativeMic) return;
    
    keepMonitoringRef.current = true;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateVolume = () => {
      if (!analyserRef.current || !keepMonitoringRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      const samples = Math.min(16, dataArray.length);
      for (let i = 0; i < samples; i++) {
        sum += dataArray[i];
      }
      const avgVolume = sum / samples;
      
      // Apply noise floor
      const adjustedVolume = Math.max(avgVolume - noiseFloor, 0);
      
      // Scale to 0-100 range, apply sensitivity
      const scaledValue = Math.min(Math.max((adjustedVolume / 255) * 100 * (sensitivity / 25), 0), 100);
      const roundedValue = Math.round(scaledValue);
      
      // Store in history for smoothing
      volumeHistoryRef.current.push(roundedValue);
      
      // Keep only the last 5 values for a moving average
      if (volumeHistoryRef.current.length > 5) {
        volumeHistoryRef.current.shift();
      }
      
      // Calculate smoothed volume (moving average)
      const smoothedVolume = volumeHistoryRef.current.reduce((sum, val) => sum + val, 0) / 
                             volumeHistoryRef.current.length;
      
      // Update current decibel state
      setCurrentDecibel(Math.round(smoothedVolume));
      
      // Update target ball position (invert: louder = higher = lower y position)
      targetBallPositionRef.current = 100 - Math.round(smoothedVolume);
      
      // Log for debugging
      if (gameActive) {
        console.log("Volume: ", Math.round(smoothedVolume), "Target Ball Position: ", targetBallPositionRef.current);
      }
      
      // Continue monitoring
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };
    
    // Start the monitoring loop
    updateVolume();
  };
  
  // Stop monitoring volume
  const stopMonitoringVolume = () => {
    keepMonitoringRef.current = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (ballAnimationRef.current) {
      cancelAnimationFrame(ballAnimationRef.current);
      ballAnimationRef.current = null;
    }
  };
  
  // Convert the microphone FFT data to an approximate decibel value (0-100 scale)
  useEffect(() => {
    if (!useNativeMic && micFft && micFft.length > 0 && gameActive) {
      // Use more FFT data points for better accuracy
      const avgValue = micFft.slice(0, 16).reduce((sum, val) => sum + val, 0) / 16;
      
      // Apply device-specific sensitivity adjustment
      const scaledValue = Math.min(Math.max(avgValue * sensitivity, 0), 100);
      const roundedValue = Math.round(scaledValue);
      
      // Store in history for smoothing
      volumeHistoryRef.current.push(roundedValue);
      
      // Keep only the last 5 values for a moving average
      if (volumeHistoryRef.current.length > 5) {
        volumeHistoryRef.current.shift();
      }
      
      // Calculate smoothed volume (moving average)
      const smoothedVolume = volumeHistoryRef.current.reduce((sum, val) => sum + val, 0) / 
                             volumeHistoryRef.current.length;
      
      // Update current decibel state
      setCurrentDecibel(Math.round(smoothedVolume));
      
      // Update target ball position (invert: louder = higher = lower y position)
      targetBallPositionRef.current = 100 - Math.round(smoothedVolume);
      
      // Log for debugging
      console.log("Hume Volume: ", Math.round(smoothedVolume), "Target Ball Position: ", targetBallPositionRef.current);
    }
  }, [micFft, gameActive, sensitivity, useNativeMic]);
  
  // Animation frame for smooth ball movement
  useEffect(() => {
    // Skip if game is not active
    if (!gameActive) return;
    
    // Function to smoothly animate the ball position
    const animateBall = () => {
      // Calculate time delta for consistent movement regardless of frame rate
      const now = Date.now();
      const deltaTime = (now - lastUpdateTimeRef.current) / 16.67; // Normalize to ~60fps
      lastUpdateTimeRef.current = now;
      
      // Get current ball position and target
      const current = ballPosition;
      const target = targetBallPositionRef.current;
      
      // Calculate new position with lerp (linear interpolation)
      // Adjust the 0.1 value to control smoothness (lower = smoother but slower)
      const lerpFactor = Math.min(0.15 * deltaTime, 1);
      const newPosition = current + (target - current) * lerpFactor;
      
      // Update ball position state if it's significantly different
      if (Math.abs(newPosition - current) > 0.1) {
        setBallPosition(newPosition);
      }
      
      // Continue animation loop
      ballAnimationRef.current = requestAnimationFrame(animateBall);
    };
    
    // Start animation loop
    ballAnimationRef.current = requestAnimationFrame(animateBall);
    
    // Cleanup function
    return () => {
      if (ballAnimationRef.current) {
        cancelAnimationFrame(ballAnimationRef.current);
        ballAnimationRef.current = null;
      }
    };
  }, [gameActive, ballPosition]);
  
  // Request microphone permission when game starts
  useEffect(() => {
    const requestMicPermission = async () => {
      try {
        // First try to connect using Hume Voice API
        if (status.value !== "connected" && connectionAttempts < 3) {
          try {
            setConnectionAttempts(prev => prev + 1);
            await connect();
            console.log("Voice service connected");
            unmute();
            setMicPermissionGranted(true);
          } catch (error) {
            console.error("Error connecting to voice service:", error);
            
            // Fall back to native microphone implementation
            console.log("Falling back to native microphone implementation");
            const success = await initializeNativeMicrophone();
            
            if (!success) {
              alert("Please allow microphone access to play this game.");
              setMicPermissionGranted(false);
            }
          }
        } else if (connectionAttempts >= 3) {
          // After 3 failed attempts, try native microphone
          console.log("Multiple connection attempts failed, using native microphone");
          const success = await initializeNativeMicrophone();
          
          if (!success) {
            alert("Please allow microphone access to play this game.");
            setMicPermissionGranted(false);
          }
        }
      } catch (error) {
        console.error("Error accessing microphone:", error);
        alert("Please allow microphone access to play this game.");
        setMicPermissionGranted(false);
      }
    };
    
    if (gameActive && !micPermissionGranted) {
      requestMicPermission();
    }
  }, [gameActive, status.value, connect, unmute, connectionAttempts, micPermissionGranted]);

  // Ensure microphone is unmuted when game is active
  useEffect(() => {
    if (gameActive && isMuted && micPermissionGranted && !useNativeMic) {
      unmute();
    }
  }, [gameActive, isMuted, unmute, micPermissionGranted, useNativeMic]);
  
  // Cleanup function
  const cleanup = () => {
    // Stop all timers and animation frames
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    stopMonitoringVolume();
    
    // Mute if using Hume voice
    if (!useNativeMic) {
      mute();
    }
  };

  // End the game
  const endGame = async () => {
    setGameActive(false);
    cleanup();
    
    // Reset game state
    setObstacles([]);
    setBallPosition(50);
    targetBallPositionRef.current = 50;
    
    // Save score to Supabase if score > 0
    if (score > 0) {
      try {
        const supabase = createBrowserClient();
        
        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        
        // Save score to database
        const { data, error } = await supabase
          .from('game_scores')
          .insert([
            { 
              score, 
              user_id: session?.user?.id || null,
              user_name: session?.user?.email?.split('@')[0] || 'Anonymous',
              difficulty: sensitivity === 15 ? 'hard' : sensitivity === 25 ? 'medium' : 'easy'
            }
          ]);
          
        if (error) {
          console.error('Error saving score:', error);
        } else {
          console.log('Score saved successfully!');
        }
      } catch (err) {
        console.error('Error saving score:', err);
      }
    }
  };

  // Game timer countdown
  useEffect(() => {
    if (gameActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Game over when timer reaches 0
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [gameActive]);

  // Game loop
  useEffect(() => {
    if (gameActive) {
      if (isMuted && !useNativeMic) {
        unmute();
      }
      
      // For native microphone, ensure monitoring is active
      if (useNativeMic && !animationFrameRef.current) {
        startMonitoringVolume();
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
      
      return () => {
        if (gameLoopRef.current) {
          clearInterval(gameLoopRef.current);
          gameLoopRef.current = null;
        }
      };
    }
  }, [gameActive, isMuted, unmute, bestScore, ballPosition, useNativeMic]);
  
  // Start the game
  const startGame = () => {
    setGameActive(true);
    setScore(0);
    setObstacles([]);
    setTimeRemaining(30);
    volumeHistoryRef.current = [];
    
    // For iOS, ensure audio is initialized on user interaction
    if (isMobile) {
      initAudioOnUserInteraction();
    }
    
    // Try to connect and unmute
    if (!useNativeMic) {
      if (status.value !== "connected") {
        connect()
          .then(() => {
            console.log("Voice service connected on game start");
            unmute();
            setMicPermissionGranted(true);
          })
          .catch(error => {
            console.error("Failed to connect voice service:", error);
            // Try native microphone as fallback
            initializeNativeMicrophone();
          });
      } else {
        unmute();
      }
    } else {
      // If using native mic, just make sure it's initialized
      if (!micPermissionGranted) {
        initializeNativeMicrophone();
      } else {
        // Restart monitoring if it was stopped
        startMonitoringVolume();
      }
    }
    
    // Force a direct call to ensure monitoring starts immediately
    setTimeout(() => {
      if (useNativeMic) {
        console.log("Forcing microphone monitoring to start");
        stopMonitoringVolume(); // Stop any existing monitoring
        startMonitoringVolume(); // Restart fresh
      }
    }, 500);
  };
  
  // Set difficulty which changes the target decibel level and sensitivity
  const setDifficulty = (level: 'easy' | 'medium' | 'hard') => {
    switch (level) {
      case 'easy':
        setTargetDecibel(30);
        setSensitivity(isMobile ? 40 : 30); // Higher sensitivity for easy mode
        break;
      case 'medium':
        setTargetDecibel(50);
        setSensitivity(isMobile ? 35 : 25); // Default sensitivity
        break;
      case 'hard':
        setTargetDecibel(70);
        setSensitivity(isMobile ? 30 : 20); // Lower sensitivity for hard mode
        break;
    }
  };
  
  // Reset microphone connection
  const resetMicrophoneConnection = async () => {
    // Stop current monitoring
    stopMonitoringVolume();
    
    // Close existing connections
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    
    // Reset state
    setConnectionAttempts(0);
    setMicPermissionGranted(false);
    
    // Try to initialize again
    if (useNativeMic) {
      await initializeNativeMicrophone();
    } else {
      try {
        await connect();
        unmute();
        setMicPermissionGranted(true);
      } catch (error) {
        console.error("Failed to reconnect to voice service:", error);
        await initializeNativeMicrophone();
      }
    }
    
    // If game is active, ensure monitoring restarts
    if (gameActive && useNativeMic) {
      setTimeout(() => {
        console.log("Restarting microphone monitoring after reset");
        startMonitoringVolume();
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <header className="w-full max-w-md mb-4">
        <h1 className="text-3xl font-bold text-center">Voice Flyer Game</h1>
        <p className="text-center text-gray-600">Control the ball with your voice!</p>
      </header>

      <div className="flex justify-between w-full max-w-md mb-2">
        <div></div> {/* Empty div for spacing */}
        <Link 
          href="/voice-flyer/scores" 
          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-sm"
        >
          View Leaderboard
        </Link>
      </div>
      
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Game area */}
        <div className="relative h-80 bg-blue-50 border-b border-gray-200">
          {gameActive ? (
            <>
              {/* Game UI */}
              <div className="absolute top-2 left-2 right-2 flex justify-between text-sm font-medium">
                <div>Score: {score}</div>
                <div>Time: {timeRemaining}s</div>
                <div>Best: {bestScore}</div>
              </div>
              
              {!micPermissionGranted && gameActive && (
                <div className="mt-2 text-xs text-center text-amber-600">
                  Waiting for microphone access...
                  <button 
                    onClick={() => initializeNativeMicrophone()}
                    className="ml-2 px-2 py-1 bg-blue-500 text-white text-xs rounded"
                  >
                    Connect Manually
                  </button>
                </div>
              )}
              
              {useNativeMic && (
                <div className="mt-2 text-xs text-center text-green-600">
                  Using device microphone directly
                </div>
              )}
              
              {isCalibrating && (
                <div className="absolute top-10 left-0 right-0 text-xs text-center text-blue-600">
                  Calibrating microphone...
                </div>
              )}
            </>
          ) : (
            <>
              {/* Start screen */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                <h2 className="text-xl font-bold mb-2">Voice Flyer</h2>
                <p className="text-sm text-center mb-4">
                  Use your voice to control the ball! Make noise to move the ball up, be quiet to let it fall.
                </p>
                <button 
                  onClick={startGame}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition"
                >
                  Start Game
                </button>
                
                <div className="mt-4 text-sm">
                  <p className="font-medium mb-2">Select Difficulty:</p>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setDifficulty('easy')}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded"
                    >
                      Easy
                    </button>
                    <button 
                      onClick={() => setDifficulty('medium')}
                      className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded"
                    >
                      Medium
                    </button>
                    <button 
                      onClick={() => setDifficulty('hard')}
                      className="px-3 py-1 bg-red-100 text-red-800 rounded"
                    >
                      Hard
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          
          {/* Game elements - only render when game is active */}
          {gameActive && (
            <>
              {/* Ball */}
              <motion.div 
                className="absolute left-1/2 w-8 h-8 bg-red-500 rounded-full shadow-md"
                style={{ 
                  top: `${ballPosition}%`, 
                  transform: 'translate(-50%, -50%)',
                  zIndex: 10
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
              
              {/* Obstacles */}
              {obstacles.map(obstacle => (
                <div key={obstacle.id} className="absolute top-0 bottom-0" style={{ left: `${obstacle.position}%`, width: '10px' }}>
                  {/* Top part of obstacle */}
                  <div className="absolute top-0 w-full bg-gray-700" style={{ height: '40%' }}></div>
                  {/* Bottom part of obstacle */}
                  <div className="absolute bottom-0 w-full bg-gray-700" style={{ height: '40%' }}></div>
                </div>
              ))}
              
              {/* Volume visualization */}
              <div className="absolute bottom-2 left-2 right-2 h-4 bg-gray-200 rounded overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                  style={{ width: `${currentDecibel}%` }}
                ></div>
              </div>
            </>
          )}
        </div>
        
        {/* Controls and info */}
        <div className="p-4">
          {/* Volume level */}
          <div className="mb-4">
            <h3 className="font-medium mb-1">Voice Volume:</h3>
            <div className="flex items-center">
              <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                  style={{ width: `${currentDecibel}%` }}
                ></div>
              </div>
              <span className="ml-2 text-sm">{currentDecibel}%</span>
            </div>
          </div>
          
          <div className="mt-4">
            <h3 className="font-medium mb-2">Microphone Sensitivity:</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs">Low</span>
              <input 
                type="range" 
                min="10" 
                max="50" 
                value={sensitivity} 
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs">High</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Adjust if the ball is too sensitive or not responsive enough to your voice.
            </p>
          </div>
          
          {!micPermissionGranted && (
            <div className="mt-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <p>Microphone access is required to play this game.</p>
              <button 
                onClick={() => initializeNativeMicrophone()}
                className="mt-2 w-full px-3 py-1.5 bg-red-600 text-white rounded"
              >
                Grant Microphone Access
              </button>
            </div>
          )}
          
          {micPermissionGranted && (
            <button 
              onClick={resetMicrophoneConnection}
              className="mt-4 w-full px-3 py-1.5 bg-blue-100 text-blue-800 rounded"
            >
              Reset Microphone Connection
            </button>
          )}
          
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
      
      <footer className="mt-4 text-xs text-gray-500">
        <Link href="/" className="hover:underline">Back to Home</Link>
      </footer>
    </div>
  );
}