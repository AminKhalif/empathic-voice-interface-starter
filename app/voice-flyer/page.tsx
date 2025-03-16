'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useVoice, VoiceProvider } from '@humeai/voice-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { createClient as createBrowserClient } from '@/lib/supabase/browser';

// Define interfaces for game objects
interface Obstacle {
  id: number;
  position: number;
  gapPosition: number;
  gapSize: number;
  passed: boolean;
  scored: boolean;
}

interface Star {
  id: string;
  x: number;
  y: number;
  collected: boolean;
}

interface Collectible {
  id: string;
  type: string;
  points: number;
  x: number;
  y: number;
  collected: boolean;
}

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
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 seconds game duration
  const [gameActive, setGameActive] = useState(false);
  const [sensitivity, setSensitivity] = useState<number>(25); // Default sensitivity
  const [noiseFloor, setNoiseFloor] = useState<number>(0);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [ballPosition, setBallPosition] = useState<number>(50);
  const [currentDecibel, setCurrentDecibel] = useState<number>(0);
  const [targetDecibel, setTargetDecibel] = useState(50); // Medium level target
  const [collectibles, setCollectibles] = useState<Array<Collectible>>([]);
  const [stars, setStars] = useState<Array<Star>>([]);
  const [powerUps, setPowerUps] = useState<Array<{id: string, type: string, x: number, y: number, collected: boolean}>>([]);
  const [particles, setParticles] = useState<Array<{id: string, x: number, y: number, color: string, size: number, speed: number, angle: number, life: number}>>([]);
  const [activePowerUp, setActivePowerUp] = useState<string | null>(null);
  const [powerUpTimeRemaining, setPowerUpTimeRemaining] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [voiceStrength, setVoiceStrength] = useState(0);
  const [voiceHistory, setVoiceHistory] = useState<Array<number>>([]);
  const [patientData, setPatientData] = useState<{
    sessionDate: string,
    averageVoiceStrength: number,
    voiceStability: number,
    itemsCollected: number,
    sessionDuration: number
  }>({
    sessionDate: new Date().toISOString(),
    averageVoiceStrength: 0,
    voiceStability: 0,
    itemsCollected: 0,
    sessionDuration: 30
  });
  const [isMobile, setIsMobile] = useState(false);
  const [useNativeMic, setUseNativeMic] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [deviceType, setDeviceType] = useState<string>('unknown');
  const [microphoneType, setMicrophoneType] = useState<string>('hume');
  const [gameData, setGameData] = useState<any>({});
  const [isSavingData, setIsSavingData] = useState<boolean>(false);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(0);
  const [showComboText, setShowComboText] = useState(false);
  const [comboText, setComboText] = useState('');
  const [gameSpeed, setGameSpeed] = useState(3);
  const [isCalibrated, setIsCalibrated] = useState(false);
  
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
  
  // Game canvas styles
  const gameCanvasStyle = {
    background: 'linear-gradient(180deg, #e0f7ff 0%, #87CEFA 100%)',
    position: 'relative' as const,
    overflow: 'hidden',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    border: '2px solid #4a90e2'
  };

  // Ball styles with improved visuals
  const ballStyle = {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 30% 30%, #ff6b6b, #c62828)',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2), inset 2px 2px 4px rgba(255, 255, 255, 0.5)',
    position: 'absolute' as const,
    left: '50%',
    transform: 'translateX(-50%)',
    transition: 'top 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)', // Smoother transition
    zIndex: 10
  };

  // Collectible item styles
  const collectibleStyle = {
    position: 'absolute' as const,
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 30% 30%, #81c784, #388e3c)',
    boxShadow: '0 0 10px #4caf50',
    animation: 'pulse 1.2s infinite ease-in-out, float 3s infinite ease-in-out',
    zIndex: 5
  };

  // Star styles for points collected
  const starStyle = {
    position: 'absolute' as const,
    width: '30px',
    height: '30px',
    color: '#FFD700',
    zIndex: 5
  };

  // Power-up styles
  const powerUpStyle = {
    position: 'absolute' as const,
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 30% 30%, #4fc3f7, #0288d1)',
    boxShadow: '0 0 15px #29b6f6',
    animation: 'pulse 1s infinite ease-in-out, float 3s infinite ease-in-out',
    zIndex: 5
  };

  // Add global CSS for animations
  const globalStyles = `
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
    
    @keyframes fadeUp {
      0% { opacity: 0; transform: translate(-50%, 0%); }
      20% { opacity: 1; transform: translate(-50%, -50%); }
      80% { opacity: 1; transform: translate(-50%, -50%); }
      100% { opacity: 0; transform: translate(-50%, -100%); }
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;

  // Cloud styles for background decoration
  const cloudStyle = (top: number, left: number, scale: number, opacity: number) => ({
    position: 'absolute' as const,
    top: `${top}%`,
    left: `${left}%`,
    width: `${scale * 100}px`,
    height: `${scale * 60}px`,
    background: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '50px',
    boxShadow: '0 4px 8px rgba(255, 255, 255, 0.3)',
    opacity,
    zIndex: 1
  });

  // Create particle effect
  const createParticles = (x: number, y: number, count: number) => {
    const newParticles: Array<{id: string, x: number, y: number, color: string, size: number, speed: number, angle: number, life: number}> = [];
    
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: `particle-${Date.now()}-${i}`,
        x,
        y,
        color: `hsl(${Math.random() * 360}, 100%, 70%)`,
        size: Math.random() * 5 + 2,
        speed: Math.random() * 2 + 1,
        angle: Math.random() * Math.PI * 2,
        life: 100
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
  };

  // Update particles
  useEffect(() => {
    if (!gameActive || particles.length === 0) return;
    
    const updateParticles = () => {
      setParticles(prev => 
        prev
          .map(particle => ({
            ...particle,
            x: particle.x + Math.cos(particle.angle) * particle.speed,
            y: particle.y + Math.sin(particle.angle) * particle.speed,
            life: particle.life - 2
          }))
          .filter(particle => particle.life > 0)
      );
    };
    
    const particleLoop = setInterval(updateParticles, 50);
    return () => clearInterval(particleLoop);
  }, [gameActive, particles]);

  // Check browser compatibility for audio features
  const checkBrowserCompatibility = () => {
    const compatibility = {
      audioContext: !!(window.AudioContext || (window as any).webkitAudioContext),
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      audioWorklet: !!(window.AudioContext && (window as any).AudioWorklet)
    };
    
    console.log("Browser compatibility check:", compatibility);
    
    return {
      isCompatible: compatibility.audioContext && compatibility.getUserMedia,
      features: compatibility
    };
  };
  
  // Detect device type for better compatibility handling
  useEffect(() => {
    const detectDevice = () => {
      const ua = navigator.userAgent;
      
      // Check for iOS devices
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      
      // Check for Mac devices
      const isMac = /Mac/.test(ua) && !isIOS;
      
      // Check for Safari browser
      const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
      
      let detectedType = 'unknown';
      
      if (isIOS) {
        detectedType = isSafari ? 'iOS Safari' : 'iOS';
      } else if (isMac) {
        detectedType = isSafari ? 'Mac Safari' : 'Mac';
      } else if (/Android/.test(ua)) {
        detectedType = 'Android';
      } else if (/Windows/.test(ua)) {
        detectedType = 'Windows';
      } else if (/Linux/.test(ua)) {
        detectedType = 'Linux';
      }
      
      console.log(`Device detected: ${detectedType}`);
      setDeviceType(detectedType);
      
      // Apply device-specific settings
      if (isIOS || isSafari) {
        // iOS/Safari needs higher sensitivity and special handling
        setSensitivity(35);
        
        // Add touchstart listener for iOS audio initialization
        document.addEventListener('touchstart', function iosTouchHandler() {
          console.log("Touch event detected on iOS - initializing audio");
          initAudioOnUserInteraction();
          // Remove the listener after first touch to avoid multiple initializations
          document.removeEventListener('touchstart', iosTouchHandler);
        }, { once: true });
        
        console.log("Applied iOS/Safari specific settings");
      }
      
      // Check browser compatibility
      const { isCompatible, features } = checkBrowserCompatibility();
      if (!isCompatible) {
        console.warn("Browser may not support all required audio features");
        
        // Show specific message for iOS Safari
        if (isIOS && isSafari) {
          alert("For best experience on iOS Safari: 1) Make sure your device is not on silent mode, 2) When prompted, allow microphone access, 3) If issues persist, try using Chrome for iOS");
        } else {
          alert("Your browser may not fully support all audio features. For best experience, use Chrome, Firefox, or Safari.");
        }
      }
    };
    
    detectDevice();
  }, []);
  
  // Detect if user is on mobile device (iPhone)
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(userAgent);
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
  }, []);
  
  // Initialize audio on user interaction (required for iOS Safari)
  const initAudioOnUserInteraction = () => {
    console.log("Initializing audio on user interaction");
    
    try {
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
        console.log("Audio context created on user interaction, state:", audioContextRef.current.state);
      }
      
      // Resume audio context if suspended (critical for iOS)
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().then(() => {
          console.log("Audio context resumed successfully on user interaction");
        }).catch(err => {
          console.error("Failed to resume audio context:", err);
        });
      }
      
      // Create a short silent buffer and play it (required for iOS to fully activate audio)
      const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      console.log("Played silent buffer to activate audio system");
      
      // Check if we're on iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        console.log("iOS device detected, using special audio initialization");
        
        // For iOS, we need to wait a moment before requesting microphone access
        setTimeout(() => {
          // Try to initialize microphone if permission not already granted
          if (!micPermissionGranted) {
            console.log("Attempting to initialize microphone after audio context activation");
            initializeNativeMicrophone();
          }
        }, 300);
      }
      
      return true;
    } catch (error: any) {
      console.error("Error initializing audio on user interaction:", error);
      alert(`Error initializing audio: ${error.message || 'Unknown error'}. Please try again or use a different browser.`);
      return false;
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
        setIsCalibrated(true);
        console.log("Microphone calibrated. Noise floor:", avgNoiseFloor);
      } else if (currentDecibel) {
        calibrationSamples.push(currentDecibel);
      }
    }, 100);
    
    return () => clearInterval(sampleInterval);
  };
  
  // Initialize native microphone as fallback
  const initializeNativeMicrophone = async () => {
    console.log("Initializing native microphone...");
    
    try {
      // Ensure audio context is created and resumed (critical for iOS)
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
        console.log("Audio context created, state:", audioContextRef.current.state);
      }
      
      // iOS Safari requires resuming the audio context during user interaction
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log("Audio context resumed from suspended state");
      }
      
      // Request microphone access with explicit constraints for better iOS compatibility
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      
      console.log("Requesting microphone access with constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Store the stream for later cleanup
      micStreamRef.current = stream;
      
      // Create and configure analyser node
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256; // Must be power of 2
      analyser.smoothingTimeConstant = 0.8; // Higher value = smoother transitions
      analyserRef.current = analyser;
      
      // Connect microphone to analyser
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyser);
      
      console.log("Microphone successfully connected to audio analyser");
      
      // Update state to reflect microphone access
      setMicPermissionGranted(true);
      setUseNativeMic(true);
      setMicrophoneType('native');
      
      // Start monitoring volume
      startMonitoringVolume();
      
      return true;
    } catch (error: any) {
      console.error("Error initializing native microphone:", error);
      
      // Specific error handling for iOS Safari
      if (error.name === 'NotAllowedError') {
        alert("Microphone access was denied. Please enable microphone access in your device settings and try again.");
        
        // Show iOS specific instructions if on iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        if (isIOS) {
          alert("On iOS, you may need to: 1) Go to Settings > Safari > Microphone, 2) Enable microphone access for this website, 3) Return to Safari and reload the page");
        }
      } else if (error.name === 'NotFoundError') {
        alert("No microphone was found on your device. Please connect a microphone and try again.");
      } else {
        alert(`Microphone error: ${error.message || 'Unknown error'}. Please try again or use a different browser.`);
      }
      
      setMicPermissionGranted(false);
      return false;
    }
  };
  
  // Start monitoring volume using native microphone
  const startMonitoringVolume = () => {
    if (!analyserRef.current || !useNativeMic) {
      console.log("Cannot start monitoring: analyser not initialized or not using native mic");
      return;
    }
    
    console.log("Starting volume monitoring...");
    keepMonitoringRef.current = true;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateVolume = () => {
      if (!analyserRef.current || !keepMonitoringRef.current) {
        console.log("Stopping volume monitoring loop");
        return;
      }
      
      try {
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume with focus on lower frequencies (voice range)
        let sum = 0;
        const samples = Math.min(16, dataArray.length);
        // Weight lower frequencies more heavily for better voice detection
        for (let i = 0; i < samples; i++) {
          // Apply weight factor that decreases with frequency
          const weight = 1 - (i / samples) * 0.5;
          sum += dataArray[i] * weight;
        }
        const avgVolume = sum / samples;
        
        // Apply noise floor
        const adjustedVolume = Math.max(avgVolume - noiseFloor, 0);
        
        // Scale to 0-100 range, apply sensitivity with non-linear scaling
        // Square root scaling gives better control at lower volumes
        const scaledValue = Math.min(
          Math.max(
            Math.sqrt((adjustedVolume / 255) * 100) * (sensitivity / 15), 
            0
          ), 
          100
        );
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
        if (gameActive && Math.random() < 0.05) { // Only log occasionally to reduce console spam
          console.log("Volume:", Math.round(smoothedVolume), "Target Ball Position:", targetBallPositionRef.current);
        }
      } catch (error) {
        console.error("Error in volume monitoring:", error);
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
    console.log("Ending game...");
    setGameActive(false);
    cleanup();
    
    // Save final game data to Supabase
    await saveGameData();
    
    // Reset game state
    setCollectibles([]);
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
              difficulty: sensitivity === 30 ? 'easy' : sensitivity === 25 ? 'medium' : 'hard',
              device_type: deviceType,
              microphone_type: microphoneType
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

  // Save game data to Supabase
  const saveGameData = async () => {
    if (!gameActive || isSavingData) return;
    
    try {
      setIsSavingData(true);
      console.log("Saving game data to Supabase...");
      
      // Prepare game data in JSONB format
      const gameData = {
        score,
        ballPosition,
        currentDecibel,
        sensitivity,
        difficulty: sensitivity === 30 ? 'easy' : sensitivity === 25 ? 'medium' : 'hard',
        microphoneType,
        deviceType,
        timestamp: new Date().toISOString()
      };
      
      // Prepare analysis data in JSONB format
      const gameAnalysis = {
        volumeHistory: volumeHistoryRef.current,
        itemsCollected: collectibles.filter(c => c.collected).length,
        averageVolume: volumeHistoryRef.current.length > 0 
          ? volumeHistoryRef.current.reduce((a, b) => a + b, 0) / volumeHistoryRef.current.length 
          : 0,
        maxVolume: volumeHistoryRef.current.length > 0 
          ? Math.max(...volumeHistoryRef.current) 
          : 0
      };
      
      // Send to API endpoint that will insert into PostgreSQL via Supabase
      const response = await fetch('/api/save-game-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'anonymous', // Will be replaced with actual user_id on server if logged in
          data: gameData,
          analysis: gameAnalysis
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        console.error("Error saving game data:", result.error);
      } else {
        console.log("Game data saved successfully with ID:", result.id);
        // Update game data state for reference
        setGameData({
          id: result.id,
          ...gameData,
          analysis: gameAnalysis
        });
      }
    } catch (error) {
      console.error("Error saving game data:", error);
    } finally {
      setIsSavingData(false);
    }
  };

  // Periodically save game data during gameplay
  useEffect(() => {
    if (gameActive) {
      // Save data every 10 seconds during gameplay
      const saveInterval = setInterval(() => {
        saveGameData();
      }, 10000);
      
      return () => clearInterval(saveInterval);
    }
  }, [gameActive]);

  // Timer for game
  useEffect(() => {
    if (gameActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            // End game when time is up
            endGame();
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameActive]);
  
  // Generate collectibles
  useEffect(() => {
    if (!gameActive) return;
    
    const generateCollectible = () => {
      // Different types of collectibles with different point values
      const collectibleTypes = [
        {type: 'circle', points: 10, probability: 0.5},
        {type: 'triangle', points: 15, probability: 0.3},
        {type: 'diamond', points: 20, probability: 0.2}
      ];
      
      // Random selection based on probability
      const rand = Math.random();
      let selectedType = collectibleTypes[0];
      let cumulativeProbability = 0;
      
      for (const type of collectibleTypes) {
        cumulativeProbability += type.probability;
        if (rand <= cumulativeProbability) {
          selectedType = type;
          break;
        }
      }
      
      // Random position (more likely to be in the middle area)
      const y = Math.floor(Math.random() * 80) + 10;
      
      const newCollectible = {
        id: `collectible-${Date.now()}`,
        type: selectedType.type,
        points: selectedType.points,
        x: 100, // Start from right side
        y,
        collected: false
      };
      
      setCollectibles(prev => [...prev, newCollectible]);
    };
    
    // Generate collectibles at intervals
    const collectibleInterval = setInterval(generateCollectible, 1000); // Every second
    return () => clearInterval(collectibleInterval);
  }, [gameActive]);
  
  // Move collectibles and check collisions
  useEffect(() => {
    if (!gameActive) return;
    
    const moveCollectibles = () => {
      setCollectibles(prev => {
        return prev
          .map(collectible => {
            // Move collectible from right to left
            const newX = collectible.x - 2;
            
            // Check if ball collected the item
            const ballX = 50; // Ball is fixed horizontally
            const ballY = ballPosition;
            const collectibleCollected = 
              !collectible.collected && 
              Math.abs(newX - ballX) < 8 && 
              Math.abs(collectible.y - ballY) < 8;
            
            // If collected, add points
            if (collectibleCollected) {
              // Add points (double if power-up is active)
              const pointsToAdd = activePowerUp === 'doublePoints' ? collectible.points * 2 : collectible.points;
              setScore(prev => prev + pointsToAdd);
              
              // Update patient data
              setPatientData(prev => ({
                ...prev,
                itemsCollected: prev.itemsCollected + 1
              }));
              
              // Show points text
              setComboText(`+${pointsToAdd}!`);
              setShowComboText(true);
              setTimeout(() => setShowComboText(false), 800);
              
              // Create particles for effect
              createParticles(ballX, ballY, 8);
            }
            
            return {
              ...collectible,
              x: newX,
              collected: collectible.collected || collectibleCollected
            };
          })
          .filter(collectible => collectible.x > -10 && !collectible.collected); // Remove collectibles that are off-screen or collected
      });
    };
    
    const collectibleLoop = setInterval(moveCollectibles, 50);
    return () => clearInterval(collectibleLoop);
  }, [gameActive, ballPosition, activePowerUp]);
  
  // Process volume data for smoother ball movement
  const processVolumeData = (volume: number) => {
    // Add to history for smoothing
    volumeHistoryRef.current.push(volume);
    
    // Keep only the last 5 values for a moving average
    if (volumeHistoryRef.current.length > 5) {
      volumeHistoryRef.current.shift();
    }
    
    // Calculate moving average for smoother movement
    const avgVolume = volumeHistoryRef.current.reduce((sum, val) => sum + val, 0) / volumeHistoryRef.current.length;
    
    // Update voice strength for patient data
    setVoiceStrength(avgVolume);
    setVoiceHistory(prev => {
      const newHistory = [...prev, avgVolume];
      if (newHistory.length > 30) newHistory.shift();
      return newHistory;
    });
    
    // Map volume to position with enhanced sensitivity
    // Scale from 0-100 to 0-100 (percentage of screen height)
    const scaledVolume = Math.min(100, avgVolume * sensitivity * 2);
    
    // Invert the position (louder = higher = lower percentage from top)
    const newPosition = 100 - scaledVolume;
    
    // Set a target position for smoother animation
    targetBallPositionRef.current = Math.max(5, Math.min(95, newPosition));
  };
  
  // Start the game
  const startGame = () => {
    console.log("Starting game...");
    
    if (!micPermissionGranted) {
      console.log("Microphone permission not granted, requesting access...");
      handleGrantMicrophoneAccess();
      
      // Show message to user
      alert("Please grant microphone access to play the game");
      return;
    }
    
    // Reset game state
    setScore(0);
    setTimeRemaining(30); // 30 seconds game duration
    setCollectibles([]);
    setStars([]);
    setPowerUps([]);
    setParticles([]);
    setBallPosition(50);
    targetBallPositionRef.current = 50;
    volumeHistoryRef.current = [];
    setVoiceHistory([]);
    setPatientData({
      sessionDate: new Date().toISOString(),
      averageVoiceStrength: 0,
      voiceStability: 0,
      itemsCollected: 0,
      sessionDuration: 30
    });
    
    // Start the game
    setGameActive(true);
    setShowTutorial(false);
    
    // If using Hume AI voice, connect to voice service
    if (!useNativeMic) {
      console.log("Using Hume AI voice service");
      connect();
      unmute();
    } else {
      console.log("Using native microphone");
      // Make sure we're monitoring volume
      startMonitoringVolume();
    }
    
    console.log("Game started successfully");
  };
  
  // Enhanced start game handler with proper initialization sequence
  const handleStartGame = () => {
    console.log("Start Game button clicked");
    
    // First ensure audio context is initialized (crucial for iOS)
    const audioInitialized = initAudioOnUserInteraction();
    
    // For iOS devices, we need a special sequence
    const isIOS = deviceType.includes('iOS');
    
    if (isIOS) {
      console.log("iOS device detected, using special game start sequence");
      
      // For iOS, we need to ensure microphone access before starting the game
      if (!micPermissionGranted) {
        console.log("iOS device without microphone permission, requesting access first");
        handleGrantMicrophoneAccess();
        
        // Show instructions to the user
        alert("Please grant microphone access when prompted, then press Start Game again");
        return;
      }
      
      // If we already have microphone access, start the game with a delay
      setTimeout(() => {
        console.log("Starting game after delay for iOS");
        startGame();
      }, 500);
    } else {
      // For non-iOS devices, we can start the game with a shorter delay
      setTimeout(() => {
        startGame();
      }, 200);
    }
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

  // Direct handler for microphone access button
  const handleGrantMicrophoneAccess = () => {
    console.log("Grant Microphone Access button clicked");
    
    // First ensure audio context is initialized (crucial for iOS)
    const audioInitialized = initAudioOnUserInteraction();
    
    // For iOS devices, we need a slight delay between audio context initialization and mic access
    const isIOS = deviceType.includes('iOS');
    const delay = isIOS ? 500 : 100;
    
    setTimeout(() => {
      console.log(`Requesting microphone access after ${delay}ms delay`);
      initializeNativeMicrophone();
    }, delay);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <header className="w-full max-w-md mb-4">
        <h1 className="text-3xl font-bold text-center">Voice Therapy Game</h1>
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
        {/* Add global styles */}
        <style jsx global>{globalStyles}</style>
        
        {/* Game area */}
        <div 
          className="w-full h-96 mb-4 relative" 
          style={gameCanvasStyle}
        >
          {/* Background clouds for decoration */}
          <div style={cloudStyle(20, 10, 1.2, 0.7)}></div>
          <div style={cloudStyle(50, 80, 0.8, 0.5)}></div>
          <div style={cloudStyle(70, 30, 1, 0.6)}></div>
          
          {/* Game elements only shown when game is active */}
          {gameActive && (
            <>
              {/* Ball */}
              <div 
                style={{
                  ...ballStyle,
                  top: `${ballPosition}%`,
                  boxShadow: activePowerUp === 'shield' ? '0 0 15px 5px rgba(64, 196, 255, 0.8)' : ballStyle.boxShadow
                }}
              ></div>
              
              {/* Collectible items */}
              {collectibles.map(collectible => (
                <div 
                  key={collectible.id}
                  style={{
                    ...collectibleStyle,
                    left: `${collectible.x}%`,
                    top: `${collectible.y}%`,
                    background: 
                      collectible.type === 'circle' ? 'radial-gradient(circle at 30% 30%, #81c784, #388e3c)' :
                      collectible.type === 'triangle' ? 'radial-gradient(circle at 30% 30%, #4fc3f7, #0288d1)' :
                      'radial-gradient(circle at 30% 30%, #ce93d8, #8e24aa)'
                  }}
                >
                  {collectible.type === 'circle' ? '●' : 
                   collectible.type === 'triangle' ? '▲' : '◆'}
                </div>
              ))}
              
              {/* Stars for bonus points */}
              {stars.map(star => (
                <div 
                  key={star.id}
                  style={{
                    ...starStyle,
                    left: `${star.x}%`,
                    top: `${star.y}%`,
                    animation: 'pulse 1.5s infinite ease-in-out'
                  }}
                >
                  ⭐
                </div>
              ))}
              
              {/* Power-ups */}
              {powerUps.map(powerUp => (
                <div 
                  key={powerUp.id}
                  style={{
                    ...powerUpStyle,
                    left: `${powerUp.x}%`,
                    top: `${powerUp.y}%`,
                    background: powerUp.type === 'shield' ? 'radial-gradient(circle at 30% 30%, #4fc3f7, #0288d1)' :
                              powerUp.type === 'slowTime' ? 'radial-gradient(circle at 30% 30%, #9575cd, #5e35b1)' :
                              'radial-gradient(circle at 30% 30%, #ffee58, #fdd835)'
                  }}
                >
                  {powerUp.type === 'shield' ? '🛡️' : 
                   powerUp.type === 'slowTime' ? '⏱️' : '2x'}
                </div>
              ))}
              
              {/* Particles */}
              {particles.map(particle => (
                <div
                  key={particle.id}
                  style={{
                    position: 'absolute',
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                    borderRadius: '50%',
                    backgroundColor: particle.color,
                    opacity: particle.life / 100,
                    zIndex: 15
                  }}
                ></div>
              ))}
              
              {/* Combo text animation */}
              {showComboText && (
                <div 
                  className="absolute text-2xl font-bold text-yellow-500"
                  style={{
                    top: '40%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    animation: 'fadeUp 1s forwards',
                    zIndex: 20,
                    textShadow: '0 0 5px rgba(0,0,0,0.5)'
                  }}
                >
                  {comboText}
                </div>
              )}
              
              {/* Active power-up indicator */}
              {activePowerUp && (
                <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center">
                  {activePowerUp === 'shield' ? '🛡️ Shield' : 
                   activePowerUp === 'slowTime' ? '⏱️ Slow Motion' : 
                   '2x Points'}
                  <span className="ml-2">{powerUpTimeRemaining}s</span>
                </div>
              )}
              
              {/* Voice strength meter */}
              <div className="absolute bottom-2 left-2 right-2 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, voiceStrength * sensitivity * 2)}%` }}
                ></div>
              </div>
            </>
          )}
          
          {/* Game start overlay */}
          {!gameActive && !showTutorial && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 text-white p-4 rounded-lg">
              <h2 className="text-2xl font-bold mb-4">Voice Therapy Game</h2>
              <p className="text-center mb-4">
                Use your voice to control the ball! Make noise to move the ball up, be quiet to let it fall.
                Collect items to score points in this 30-second exercise.
              </p>
              <button 
                onClick={handleStartGame}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition"
              >
                Start Exercise
              </button>
            </div>
          )}
          
          {/* Tutorial overlay */}
          {showTutorial && !gameActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 text-white p-4 rounded-lg">
              <h2 className="text-2xl font-bold mb-4">Voice Therapy Exercise</h2>
              
              {tutorialStep === 1 && (
                <>
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-500 mr-4"></div>
                    <p>Control the ball with your voice! Make noise to move up, be quiet to fall down. This exercise helps track your voice control progress.</p>
                  </div>
                  <button 
                    onClick={() => setTutorialStep(2)}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition mt-4"
                  >
                    Next
                  </button>
                </>
              )}
              
              {tutorialStep === 2 && (
                <>
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 flex justify-center items-center text-2xl mr-4">●</div>
                    <p>Collect items by guiding the ball to them. Different shapes have different point values.</p>
                  </div>
                  <button 
                    onClick={() => setTutorialStep(3)}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition mt-4"
                  >
                    Next
                  </button>
                </>
              )}
              
              {tutorialStep === 3 && (
                <>
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 flex justify-center items-center text-2xl mr-4">📊</div>
                    <p>Your voice strength and stability are measured during the 30-second exercise. This data helps track your progress over time.</p>
                  </div>
                  <button 
                    onClick={() => {setShowTutorial(false); handleStartGame();}}
                    className="px-6 py-2 bg-green-500 text-white rounded-lg shadow hover:bg-green-600 transition mt-4"
                  >
                    Start Exercise
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Game stats and controls */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <div className="text-lg font-bold">Score: {score}</div>
            <div className="text-lg">Time: {timeRemaining}s</div>
            <div className="text-lg font-bold">Best: {bestScore}</div>
          </div>
          
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
                onClick={handleGrantMicrophoneAccess}
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