"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

interface ExpressionGameProps {
  accessToken: string;
}

export default function ExpressionGame({ accessToken }: ExpressionGameProps) {
  const [gameState, setGameState] = useState<"idle" | "countdown" | "playing" | "success" | "failed">("idle");
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(30);
  const [joyScore, setJoyScore] = useState(0);
  const [joyThreshold] = useState(0.6); // Threshold for "joyful" expression
  const [failedTime, setFailedTime] = useState(0);
  const [bestTime, setBestTime] = useState(0);
  const [webcamReady, setWebcamReady] = useState(false);
  const [useMockImplementation, setUseMockImplementation] = useState(false);
  const [showCameraTest, setShowCameraTest] = useState(false);
  const [useAlternativeCamera, setUseAlternativeCamera] = useState(false);
  const [showJoyWarning, setShowJoyWarning] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const testVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const animationRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Setup webcam - but only when manually triggered
  const requestCameraAccess = async (targetRef: React.RefObject<HTMLVideoElement> = videoRef) => {
    console.log("Manually requesting camera permission...");
    if (typeof navigator === "undefined") return;

    try {
      console.log("Requesting camera permission...");
      
      // Try with specific constraints to target the webcam directly
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
          frameRate: { ideal: 30 }
        },
        audio: false
      };
      
      console.log("Using constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log("Camera permission granted, setting up video element");
      if (targetRef.current) {
        // Ensure video element is properly reset
        targetRef.current.srcObject = null;
        targetRef.current.pause();
        
        // Set the stream and try to play
        targetRef.current.srcObject = stream;
        
        // Try to play the video immediately
        try {
          await targetRef.current.play();
          console.log("Video playback started successfully");
        } catch (playError) {
          console.error("Error playing video:", playError);
        }
        
        // Set webcam ready
        setWebcamReady(true);
        
        // Log video element properties to debug
        console.log("Video element:", {
          videoWidth: targetRef.current.videoWidth,
          videoHeight: targetRef.current.videoHeight,
          readyState: targetRef.current.readyState,
          paused: targetRef.current.paused
        });
        
        // Add event listeners for debugging
        targetRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          setWebcamReady(true);
        };
        
        targetRef.current.oncanplay = () => {
          console.log("Video can play");
          setWebcamReady(true);
          
          // Log updated video properties
          if (targetRef.current) {
            console.log("Video element after canplay:", {
              videoWidth: targetRef.current.videoWidth,
              videoHeight: targetRef.current.videoHeight,
              readyState: targetRef.current.readyState,
              paused: targetRef.current.paused
            });
          }
        };
        
        // Add error handling for video
        targetRef.current.onerror = (e) => {
          console.error("Video element error:", e);
        };
      } else {
        console.error("Video reference not available");
      }
    } catch (error) {
      console.error("Error accessing webcam:", error);
    }
  };

  // Remove automatic webcam setup from useEffect, make it manual instead
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Connect to Hume WebSocket when game starts
  useEffect(() => {
    console.log("WebSocket effect running, gameState:", gameState, "webcamReady:", webcamReady);
    if (gameState !== "playing" || !webcamReady) return;

    console.log("Attempting to connect to Hume WebSocket with token:", accessToken);
    
    const connectWebSocket = () => {
      // Use the query parameter for apiKey since browser WebSocket doesn't support headers
      console.log("Connecting to WebSocket with access token");
      const ws = new WebSocket(`wss://api.hume.ai/v0/stream/models?apiKey=${accessToken}`);
      
      // Set binary type to arraybuffer
      ws.binaryType = 'arraybuffer';
      
      ws.onopen = () => {
        console.log("WebSocket connected successfully");
        startCapturingFrames();
      };
      
      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          console.log("Received WebSocket response:", response);
          
          // Extract joy score from facial expression predictions
          if (response.face && response.face.predictions && response.face.predictions.length > 0) {
            console.log("Face predictions received");
            
            // Find joy in emotions array
            const emotions = response.face.predictions[0].emotions || [];
            const joyEmotion = emotions.find((emotion: any) => emotion.name === "Joy");
            
            if (joyEmotion) {
              console.log("Joy emotion found, score:", joyEmotion.score);
              setJoyScore(joyEmotion.score);
              
              // Check if joy score drops below threshold during the game
              if (joyEmotion.score < joyThreshold && gameState === "playing") {
                console.log("Joy score below threshold, ending game");
                endGame("failed");
              }
            } else {
              // Try to find joy directly in scores object (alternative format)
              const scores = response.face.predictions[0].scores || {};
              if (scores.joy !== undefined) {
                console.log("Joy found in scores, value:", scores.joy);
                setJoyScore(scores.joy);
                
                if (scores.joy < joyThreshold && gameState === "playing") {
                  console.log("Joy score below threshold, ending game");
                  endGame("failed");
                }
              } else {
                console.log("Joy emotion not found in response, raw data:", JSON.stringify(response.face.predictions));
              }
            }
          } else {
            console.log("No valid face predictions in response");
          }
        } catch (error) {
          console.error("Error parsing WebSocket response:", error);
        }
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
      
      ws.onclose = (event) => {
        console.log("WebSocket closed with code:", event.code, "reason:", event.reason);
      };
      
      wsRef.current = ws;
    };

    const startCapturingFrames = () => {
      if (!canvasRef.current || !videoRef.current || !wsRef.current) return;
      
      const context = canvasRef.current.getContext("2d");
      if (!context) return;

      // Start capturing frames - limit to 2 frames per second to avoid rate limiting
      let lastCaptureTime = 0;
      const captureInterval = 500; // Capture at most every 500ms (2 fps)
      
      const captureFrame = () => {
        if (!canvasRef.current || !videoRef.current || !wsRef.current || gameState !== "playing") return;
        
        const now = Date.now();
        if (now - lastCaptureTime < captureInterval) {
          // Not enough time has passed, schedule next frame check
          animationRef.current = requestAnimationFrame(captureFrame);
          return;
        }
        
        lastCaptureTime = now;
        
        try {
          // Draw video frame to canvas
          context.drawImage(
            videoRef.current,
            0, 0,
            canvasRef.current.width,
            canvasRef.current.height
          );
          
          // Convert canvas to blob and send to WebSocket
          canvasRef.current.toBlob((blob) => {
            if (blob && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              // Create a FileReader to read the blob as base64
              const reader = new FileReader();
              reader.onloadend = () => {
                // Extract the base64 data (remove the data URL prefix)
                const base64data = reader.result as string;
                const base64Image = base64data.split(',')[1];
                
                // Create the message payload with base64 encoded image
                const message = {
                  models: {
                    face: {
                      facs: true,
                      descriptions: true
                    }
                  },
                  data: base64Image,
                  source_type: "image/jpeg;base64"
                };
                
                console.log("Sending frame to Hume API");
                if (wsRef.current) {
                  wsRef.current.send(JSON.stringify(message));
                } else {
                  console.error("WebSocket reference is null");
                }
              };
              reader.readAsDataURL(blob);
            }
          }, "image/jpeg", 0.8);
        } catch (error) {
          console.error("Error capturing frame:", error);
        }
        
        // Schedule next frame capture
        animationRef.current = requestAnimationFrame(captureFrame);
      };
      
      // Start capturing frames
      animationRef.current = requestAnimationFrame(captureFrame);
    };

    connectWebSocket();

    return () => {
      // Clean up
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [gameState, webcamReady, accessToken, joyThreshold]);

  // Game timer
  useEffect(() => {
    if (gameState !== "playing") return;
    
    timerRef.current = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          // Game completed successfully
          endGame("success");
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState]);

  // Countdown timer
  useEffect(() => {
    if (gameState !== "countdown") return;
    
    countdownRef.current = setInterval(() => {
      setCountdown((prevCount) => {
        if (prevCount <= 1) {
          // Start the game
          setGameState("playing");
          setTimer(30);
          return 0;
        }
        return prevCount - 1;
      });
    }, 1000);
    
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [gameState]);

  // Mock implementation for testing without camera
  useEffect(() => {
    if (!useMockImplementation || gameState !== "playing") return;
    
    console.log("Using mock implementation for testing");
    
    // Simulate varying joy scores
    const mockInterval = setInterval(() => {
      // Generate a random joy score, biased toward higher values
      // but occasionally dipping below the threshold to test failure case
      const baseScore = Math.random() * 0.5 + 0.4; // 0.4 to 0.9
      const variation = (Math.random() - 0.5) * 0.3; // -0.15 to 0.15
      const newScore = Math.max(0, Math.min(1, baseScore + variation));
      
      console.log("Setting mock joy score:", newScore);
      setJoyScore(newScore);
      
      // Occasionally drop below threshold to test failure case
      if (newScore < joyThreshold) {
        console.log("Mock joy score below threshold");
        if (Math.random() < 0.3) { // 30% chance to actually fail when below threshold
          console.log("Triggering mock failure");
          endGame("failed");
        }
      }
    }, 500);
    
    return () => {
      clearInterval(mockInterval);
    };
  }, [useMockImplementation, gameState, joyThreshold]);

  // Start the game
  const startGame = () => {
    // If mock implementation is enabled, we don't need the webcam to be ready
    if (!webcamReady && !useMockImplementation) {
      console.log("Webcam not ready and mock mode is disabled");
      return;
    }
    
    setCountdown(3);
    setGameState("countdown");
  };

  // End the game
  const endGame = (result: "success" | "failed") => {
    setGameState(result);
    
    if (result === "failed") {
      setFailedTime(30 - timer);
    } else if (result === "success") {
      // Set new best time if this is the first successful attempt or better than previous
      if (bestTime === 0 || 30 > bestTime) {
        setBestTime(30);
      }
    }
    
    // Clean up timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Reset the game
  const resetGame = () => {
    setGameState("idle");
    setJoyScore(0);
    setTimer(30);
  };

  // Add this new function to try the alternative camera and connect to Hume
  const switchToAlternativeCamera = async () => {
    setUseAlternativeCamera(true);
    // Wait for state to update
    setTimeout(async () => {
      try {
        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false
        });
        
        // Get the alternative video element by ID
        const altVideo = document.getElementById('altVideo') as HTMLVideoElement;
        if (altVideo) {
          altVideo.srcObject = stream;
          altVideo.play()
            .then(() => {
              console.log("Alternative video playing");
              setWebcamReady(true);
              
              // Connect to Hume API and start sending frames
              connectToHumeAPI(altVideo);
            })
            .catch(err => {
              console.error("Error playing alternative video:", err);
            });
        }
      } catch (error) {
        console.error("Error with alternative camera:", error);
      }
    }, 100);
  };
  
  // Function to connect to Hume API and start sending frames
  const connectToHumeAPI = (videoElement: HTMLVideoElement) => {
    // Only connect if we're not in mock mode
    if (useMockImplementation) {
      console.log("Mock mode is active, not connecting to Hume API");
      return;
    }
    
    console.log("🔌 Connecting to Hume API with access token:", accessToken);
    
    // Create WebSocket connection
    console.log("🌐 Creating WebSocket connection to wss://api.hume.ai/v0/stream/models");
    const humeApiUrl = `wss://api.hume.ai/v0/stream/models?apiKey=${accessToken}`;
    
    const ws = new WebSocket(humeApiUrl);
    ws.binaryType = 'arraybuffer';
    
    // Add a timeout to detect connection issues
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.error("⏱️ WebSocket connection timeout - failed to connect to Hume API");
        
        if (debugMode) {
          alert("Failed to connect to Hume API. Check console for details.");
        }
      }
    }, 5000);
    
    // Handle connection opening
    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      console.log("🟢 Hume WebSocket connected successfully");
      
      if (debugMode) {
        alert("Successfully connected to Hume API!");
      }
      
      // Create a canvas for capturing frames
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error("Could not get canvas context");
        return;
      }
      
      // Store WebSocket in ref
      wsRef.current = ws;
      
      // Start capturing frames when game is playing
      let captureInterval: number | null = null;
      
      // Function to start the frame capture
      const startFrameCapture = () => {
        console.log("🎬 Starting frame capture for Hume API");
        
        // Start capturing frames
        const captureIntervalTime = 500; // 2 FPS
        
        captureInterval = window.setInterval(() => {
          // Check if we should stop the capture
          const shouldStop = 
            !wsRef.current || 
            wsRef.current.readyState !== WebSocket.OPEN || 
            gameState !== "playing";
            
          if (shouldStop) {
            console.log("Stopping capture interval");
            if (captureInterval) {
              clearInterval(captureInterval);
              captureInterval = null;
            }
            return;
          }
          
          try {
            // Draw video frame to canvas
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            // Convert canvas to base64
            const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            
            // Create the message payload
            const message = {
              models: {
                face: {}  // Simplified model settings to ensure compatibility
              },
              data: base64Image,
              source_type: "image/jpeg;base64"
            };
            
            // Send to Hume API
            if (wsRef.current) {
              wsRef.current.send(JSON.stringify(message));
              console.log("🚀 Frame sent to Hume API:", new Date().toISOString());
            } else {
              console.error("WebSocket reference is null");
            }
          } catch (error) {
            console.error("Error capturing frame:", error);
          }
        }, captureIntervalTime);
      };
      
      // Start frame capture if game is already playing
      if (gameState === "playing") {
        startFrameCapture();
      }
      
      // Watch for state changes to begin frame capture
      const stateWatcher = setInterval(() => {
        console.log("🔍 Checking game state:", gameState);
        if (gameState === "playing") {
          startFrameCapture();
          clearInterval(stateWatcher);
        }
      }, 100);
      
      // Set up event listener for game state changes
      document.addEventListener('click', function startGameListener(e) {
        const target = e.target as HTMLElement;
        if (target.textContent?.includes('Start Game')) {
          console.log("🎮 Start Game button clicked, preparing for frame capture");
          setTimeout(() => {
            if (gameState === "playing" || gameState === "countdown") {
              startFrameCapture();
              document.removeEventListener('click', startGameListener);
            }
          }, 4000); // Longer timeout to account for countdown
        }
      });
    };
    
    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        console.log("📥 Received Hume API response:", response);
        
        // Extract joy score from facial expression predictions
        if (response.face && response.face.predictions && response.face.predictions.length > 0) {
          console.log("👤 Face predictions received");
          
          // Find joy in emotions array
          const emotions = response.face.predictions[0].emotions || [];
          const joyEmotion = emotions.find((emotion: any) => emotion.name === "Joy");
          
          if (joyEmotion) {
            console.log("😊 Joy emotion found, score:", joyEmotion.score);
            setJoyScore(joyEmotion.score);
            
            // Don't end game, just show warnings when joy score drops
            if (joyEmotion.score < joyThreshold && gameState === "playing") {
              console.log("⚠️ Joy score below threshold, showing warning");
              setShowJoyWarning(true);
              // Hide warning after 2 seconds
              setTimeout(() => setShowJoyWarning(false), 2000);
            }
          } else {
            // Try to find joy directly in scores object (alternative format)
            const scores = response.face.predictions[0].scores || {};
            if (scores.joy !== undefined) {
              console.log("😊 Joy found in scores, value:", scores.joy);
              setJoyScore(scores.joy);
              
              // Don't end game, just show warnings when joy score drops
              if (scores.joy < joyThreshold && gameState === "playing") {
                console.log("⚠️ Joy score below threshold, showing warning");
                setShowJoyWarning(true);
                // Hide warning after 2 seconds
                setTimeout(() => setShowJoyWarning(false), 2000);
              }
            } else {
              console.log("❌ Joy emotion not found in response");
              console.log("📊 Available emotions:", emotions.map((e: any) => e.name).join(", "));
              console.log("🔍 Raw predictions:", JSON.stringify(response.face.predictions, null, 2));
            }
          }
        } else {
          console.log("❌ No valid face predictions in response");
          console.log("Full response:", JSON.stringify(response, null, 2));
        }
      } catch (error) {
        console.error("Error parsing WebSocket response:", error);
      }
    };
    
    ws.onerror = (error) => {
      console.error("❌ Hume WebSocket error:", error);
      if (debugMode) {
        alert(`WebSocket error: ${JSON.stringify(error)}`);
      }
    };
    
    ws.onclose = (event) => {
      console.log("🔴 Hume WebSocket closed with code:", event.code, "reason:", event.reason);
      
      if (debugMode) {
        alert(`WebSocket closed: Code ${event.code}, Reason: ${event.reason || 'None provided'}`);
      }
      
      // Try to reconnect if unexpectedly closed
      if (event.code !== 1000 && event.code !== 1001) {
        console.log("🔄 Attempting to reconnect to Hume API...");
        setTimeout(() => {
          if (gameState === "playing") {
            connectToHumeAPI(videoElement);
          }
        }, 3000);
      }
    };
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Joy Expression Game</h1>
      <p className="text-gray-600 mb-6 text-center">
        Challenge yourself to maintain a joyful expression for 30 seconds.
        <br />
        <span className="text-sm">Great for facial muscle training in Parkinson's therapy</span>
      </p>

      {/* Video feed and canvas (hidden) */}
      <div className="relative w-full max-w-md aspect-video bg-gray-200 rounded-lg overflow-hidden mb-6 border-2 border-dashed border-gray-400">
        {webcamReady && !useMockImplementation ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              width={640}
              height={480}
              className="absolute inset-0 w-full h-full object-cover z-10 bg-black"
              style={{ transform: 'scaleX(-1)' }} /* Mirror the video for selfie view */
            />
            {/* Clearer indicator that camera should be visible here */}
            <div className="absolute inset-0 z-20 pointer-events-none">
              <div className="absolute top-2 right-2 flex items-center bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                <div className="w-2 h-2 rounded-full bg-white mr-1 animate-pulse"></div>
                Camera Active
              </div>
              {/* Add test pattern in the background to verify rendering works */}
              <div className="absolute inset-0 flex items-center justify-center z-5 opacity-30">
                <div className="w-32 h-32 bg-gradient-radial from-white to-transparent rounded-full"></div>
              </div>
            </div>
          </>
        ) : useMockImplementation ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-100">
            <div className="text-3xl mb-2">😊</div>
            <p className="text-yellow-800 font-bold">MOCK MODE ACTIVE</p>
            <p className="text-sm text-yellow-700">Using simulated joy scores</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500 mb-4"></div>
            <p className="text-gray-700 mb-4">Camera not connected</p>
            <button
              onClick={() => requestCameraAccess()}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg"
            >
              Connect Camera
            </button>
          </div>
        )}
        
        {/* Overlay UI based on game state */}
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
        
        {/* Joy indicator overlay */}
        {(gameState === "playing" || gameState === "countdown") && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/30">
            <div className="relative h-3 bg-white/50 rounded-full overflow-hidden">
              <motion.div
                className="absolute top-0 left-0 h-full bg-yellow-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${joyScore * 100}%` }}
                transition={{ duration: 0.2 }}
              />
              <div 
                className="absolute top-0 h-full w-px bg-red-500" 
                style={{ left: `${joyThreshold * 100}%` }}
              />
            </div>
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

      {/* Timer and controls */}
      <div className="w-full max-w-md flex flex-col items-center">
        {gameState === "playing" && (
          <div className="text-4xl font-bold mb-6">{timer}s</div>
        )}
        
        {gameState === "idle" && (
          <button
            onClick={startGame}
            disabled={!webcamReady && !useMockImplementation}
            className="py-3 px-8 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {webcamReady || useMockImplementation ? "Start Game" : "Waiting for Camera..."}
          </button>
        )}
        
        {(gameState === "success" || gameState === "failed") && (
          <div className="flex gap-4">
            <button
              onClick={resetGame}
              className="py-3 px-8 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg"
            >
              Try Again
            </button>
            <Link href="/" className="py-3 px-8 bg-gray-200 hover:bg-gray-300 font-medium rounded-lg">
              Home
            </Link>
          </div>
        )}

        {/* Best time */}
        {bestTime > 0 && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg w-full text-center">
            <h3 className="text-lg font-bold">Best Time</h3>
            <p className="text-2xl font-bold">{bestTime} seconds</p>
          </div>
        )}
        
        {/* Game instructions */}
        <div className="mt-6 p-4 bg-gray-100 rounded-lg w-full text-sm">
          <h3 className="font-bold mb-2">How to Play:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Position your face in the camera view</li>
            <li>Click "Start Game" when ready</li>
            <li>Smile as genuinely as possible</li>
            <li>Maintain your joyful expression for 30 seconds</li>
            <li>The yellow bar shows your joy level in real-time</li>
            <li>If your joy level falls below the red line, you'll need to try again</li>
          </ol>
        </div>
        
        {/* Debug section - can be removed in production */}
        <div className="mt-6 p-4 border border-dashed border-gray-300 rounded-lg w-full">
          <h3 className="font-bold mb-2 text-gray-700">Game Options:</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Camera Status:</span>
              <span className={`px-2 py-1 rounded text-sm ${webcamReady ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {webcamReady ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="font-medium">Mock Mode:</span>
              <button 
                onClick={() => {
                  setUseMockImplementation(!useMockImplementation);
                  // If enabling mock mode, also set webcam ready to ensure game can start
                  if (!useMockImplementation) {
                    setWebcamReady(true);
                  }
                }} 
                className={`px-3 py-1 text-sm rounded ${useMockImplementation ? 'bg-yellow-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                {useMockImplementation ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            
            <div className="flex justify-between gap-2 mt-2">
              <button 
                onClick={() => setWebcamReady(true)} 
                className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200 flex-1"
              >
                Force Camera Ready
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="px-3 py-1 bg-gray-200 text-sm rounded hover:bg-gray-300 flex-1"
              >
                Reload Page
              </button>
            </div>
            
            <div className="flex justify-between gap-2 mt-2">
              <button 
                onClick={switchToAlternativeCamera} 
                className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200 flex-1"
              >
                Try Alternative Camera
              </button>
            </div>
            
            {/* Advanced camera diagnostics */}
            <div className="mt-4 border-t pt-4">
              <h4 className="font-medium mb-2 text-gray-700 flex items-center">
                <span>Camera Diagnostics</span>
                <button 
                  onClick={() => {
                    // Toggle a simple test pattern
                    if (canvasRef.current) {
                      const ctx = canvasRef.current.getContext('2d');
                      if (ctx) {
                        // Create a simple test pattern
                        ctx.fillStyle = 'green';
                        ctx.fillRect(0, 0, 320, 240);
                        ctx.fillStyle = 'red';
                        ctx.fillRect(80, 60, 160, 120);
                        ctx.fillStyle = 'white';
                        ctx.font = '16px Arial';
                        ctx.fillText('Camera Test', 120, 120);
                        
                        // Display the test pattern
                        canvasRef.current.className = 'block mx-auto mt-2 border';
                        setTimeout(() => {
                          if (canvasRef.current) canvasRef.current.className = 'hidden';
                        }, 5000);
                      }
                    }
                  }}
                  className="ml-2 px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300"
                >
                  Test Draw
                </button>
              </h4>
              
              <div className="text-xs space-y-1 text-gray-500">
                <div>Browser: {typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').slice(-3).join(' ') : 'Unknown'}</div>
                <div>Camera API: {typeof navigator !== 'undefined' && navigator.mediaDevices ? 'Available' : 'Not Available'}</div>
                <div>
                  <button 
                    onClick={() => {
                      setShowCameraTest(true);
                      // Wait for the component to update with test video element
                      setTimeout(() => {
                        requestCameraAccess(testVideoRef);
                      }, 100);
                    }} 
                    className="px-2 py-0.5 text-xs bg-blue-200 text-blue-800 rounded hover:bg-blue-300 mr-2"
                  >
                    Show Test Camera
                  </button>
                  
                  <button 
                    onClick={async () => {
                      try {
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        const videoDevices = devices.filter(device => device.kind === 'videoinput');
                        console.log('Available video devices:', videoDevices);
                        alert(`Found ${videoDevices.length} video devices:\n${videoDevices.map(d => d.label || 'Unnamed device').join('\n')}`);
                      } catch (err) {
                        console.error('Error listing devices:', err);
                        alert('Error listing devices');
                      }
                    }}
                    className="px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300"
                  >
                    List Camera Devices
                  </button>
                </div>
              </div>
            </div>

            {/* Add a test section to the camera diagnostics */}
            <div className="mt-4 border-t pt-4">
              <h4 className="font-medium mb-2 text-gray-700">Joy Score Test:</h4>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setJoyScore(Math.random())}
                  className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded hover:bg-yellow-200"
                >
                  Random Joy Score
                </button>
                <button 
                  onClick={() => setJoyScore(0.8)} 
                  className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200"
                >
                  High Joy (0.8)
                </button>
                <button 
                  onClick={() => setJoyScore(0.4)} 
                  className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded hover:bg-red-200"
                >
                  Low Joy (0.4)
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Use these buttons to test if the joy score display is updating properly.
              </div>
            </div>

            {/* Add a debug toggle button to the Game Options section */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Debug Mode:</span>
              <button 
                onClick={() => setDebugMode(!debugMode)} 
                className={`px-3 py-1 text-sm rounded ${debugMode ? 'bg-purple-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                {debugMode ? 'Debug Mode: ON' : 'Debug Mode: OFF'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="mt-4 flex flex-wrap justify-between w-full text-xs text-gray-500">
          <div>Mode: {useMockImplementation ? 'Mock (Simulated)' : 'Real Camera'}</div>
          <div>Camera: {webcamReady ? 'Ready' : 'Not Ready'}</div>
          <div>Joy Score: {joyScore.toFixed(2)}</div>
        </div>
      </div>

      {/* Add a test camera display for direct troubleshooting */}
      {showCameraTest && (
        <div className="mt-4 p-4 bg-black border-2 border-yellow-400 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-bold">Camera Test Mode</h3>
            <button 
              onClick={() => setShowCameraTest(false)} 
              className="px-3 py-1 bg-red-500 text-white text-sm rounded"
            >
              Close Test
            </button>
          </div>
          
          <div className="relative aspect-video bg-gray-800 overflow-hidden">
            <video
              ref={testVideoRef}
              autoPlay
              playsInline
              muted
              controls
              className="w-full h-full object-contain"
            />
            <div className="absolute bottom-2 right-2 text-xs bg-white/70 p-1 rounded">
              Direct video element test
            </div>
          </div>
          
          <div className="mt-2 flex gap-2">
            <button 
              onClick={() => requestCameraAccess(testVideoRef)} 
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded flex-1"
            >
              Reconnect Camera
            </button>
          </div>
        </div>
      )}

      {/* Prominent Joy Score Display */}
      {gameState === "playing" && (
        <div className="mt-4 mb-6 bg-gray-100 p-4 rounded-lg w-full max-w-md">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Joy Score:</h3>
            <div className="text-2xl font-bold">{joyScore.toFixed(2)}</div>
          </div>
          
          <div className="mt-2 relative h-6 bg-gray-200 rounded-full overflow-hidden">
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
            <div className="absolute inset-0 flex items-center justify-center z-10 text-gray-800 font-bold">
              {joyScore >= joyThreshold ? '😊 Great smile!' : '😐 Smile more!'}
            </div>
          </div>
        </div>
      )}

      {/* Add the alternative video element at the end of the component, before the final closing tag */}
      {useAlternativeCamera && (
        <div className="mt-4 p-4 bg-black rounded-lg">
          <h3 className="text-white font-bold mb-2 flex justify-between items-center">
            <span>Alternative Camera Display</span>
            {gameState === "playing" && (
              <span className="text-sm bg-yellow-500 text-black px-3 py-1 rounded-full">
                Joy Score: {joyScore.toFixed(2)}
              </span>
            )}
          </h3>
          <div className="relative aspect-video overflow-hidden bg-gray-800">
            {/* Using id instead of ref for direct DOM access */}
            <video 
              id="altVideo"
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover"
            ></video>
            
            {/* Enhanced joy score indicator */}
            {gameState === "playing" && (
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50">
                <div className="relative h-6 bg-white/30 rounded-full overflow-hidden">
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
                  <div className="absolute inset-0 flex items-center justify-center z-10 text-black font-bold text-sm">
                    {joyScore.toFixed(2)} {joyScore >= joyThreshold ? '😊' : '😐'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Joy warning overlay */}
      {gameState === "playing" && showJoyWarning && (
        <div className="absolute bottom-8 left-0 right-0 mx-auto w-3/4 bg-yellow-500 text-black py-2 px-4 rounded-full text-center animate-pulse">
          <span className="font-bold">Smile more! 😊</span>
        </div>
      )}
    </div>
  );
} 