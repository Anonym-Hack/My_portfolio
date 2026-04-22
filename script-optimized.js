// ============================================
// FITGUARD - OPTIMIZED VERSION (NO FREEZE)
// ============================================

// DOM Elements
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const feedbackText = document.getElementById('feedback-text');
const repCounter = document.getElementById('rep-counter');

// State Variables
let pose;
let repCount = 0;
let lastSquatState = 'up';
let isProcessing = false;
let animationId = null;

// ============================================
// MEDIAPIPE POSE SETUP
// ============================================

function initializePose() {
    pose = new Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
    });

    // Optimized settings for performance
    pose.setOptions({
        modelComplexity: 0,         // Lightest model
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);
}

// ============================================
// DIRECT WEBCAM SETUP (NO MEDIAPIPE CAMERA)
// ============================================

async function startCamera() {
    try {
        // Use getUserMedia directly
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });
        
        videoElement.srcObject = stream;
        
        videoElement.onloadedmetadata = () => {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            updateFeedback('Camera ready! Stand back and squat', 'good');
            
            // Start processing loop
            processFrame();
        };
        
    } catch (error) {
        console.error('Camera error:', error);
        updateFeedback('Camera access denied. Please allow camera.', 'warning');
    }
}

// ============================================
// FRAME PROCESSING LOOP
// ============================================

async function processFrame() {
    // Only process if not currently processing
    if (!isProcessing && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        isProcessing = true;
        
        try {
            await pose.send({ image: videoElement });
        } catch (error) {
            console.error('Pose processing error:', error);
        } finally {
            isProcessing = false;
        }
    }
    
    // Request next frame (60fps max, but processing happens at ~15-30fps)
    animationId = requestAnimationFrame(processFrame);
}

// ============================================
// POSE DETECTION CALLBACK
// ============================================

function onPoseResults(results) {
    // Clear canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // Draw connections (skeleton)
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#00FF00',
            lineWidth: 4
        });
        
        // Draw landmarks (joints)
        drawLandmarks(canvasCtx, results.poseLandmarks, {
            color: '#FF0000',
            lineWidth: 2,
            radius: 6
        });

        // Analyze squat posture
        analyzeSquat(results.poseLandmarks);
    } else {
        updateFeedback('Step into frame', 'warning');
    }

    canvasCtx.restore();
}

// ============================================
// ANGLE CALCULATION
// ============================================

function calculateAngle(pointA, pointB, pointC) {
    const vectorBA = {
        x: pointA.x - pointB.x,
        y: pointA.y - pointB.y
    };
    
    const vectorBC = {
        x: pointC.x - pointB.x,
        y: pointC.y - pointB.y
    };
    
    const dotProduct = vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y;
    const magnitudeBA = Math.sqrt(vectorBA.x ** 2 + vectorBA.y ** 2);
    const magnitudeBC = Math.sqrt(vectorBC.x ** 2 + vectorBC.y ** 2);
    
    const angleRad = Math.acos(dotProduct / (magnitudeBA * magnitudeBC));
    const angleDeg = angleRad * (180 / Math.PI);
    
    return angleDeg;
}

// ============================================
// SQUAT ANALYSIS LOGIC
// ============================================

function analyzeSquat(landmarks) {
    // Landmark indices
    const LEFT_SHOULDER = 11;
    const LEFT_HIP = 23;
    const LEFT_KNEE = 25;
    const LEFT_ANKLE = 27;

    const shoulder = landmarks[LEFT_SHOULDER];
    const hip = landmarks[LEFT_HIP];
    const knee = landmarks[LEFT_KNEE];
    const ankle = landmarks[LEFT_ANKLE];

    // Calculate angles
    const kneeAngle = calculateAngle(hip, knee, ankle);
    const backAngle = calculateAngle(shoulder, hip, knee);

    // Feedback logic
    let feedback = '';
    let feedbackType = 'good';
    
    if (kneeAngle > 140) {
        feedback = 'Go lower! Bend your knees more';
        feedbackType = 'warning';
    }
    else if (kneeAngle < 60) {
        feedback = 'Good depth! You can go up now';
        feedbackType = 'good';
    }
    else if (backAngle < 140) {
        feedback = 'Keep your back straight! Chest up';
        feedbackType = 'warning';
    }
    else if (kneeAngle >= 70 && kneeAngle <= 110 && backAngle >= 140) {
        feedback = '✓ Perfect squat form!';
        feedbackType = 'good';
    }
    else if (kneeAngle < 140) {
        feedback = 'Good form - keep going';
        feedbackType = 'good';
    }
    else {
        feedback = 'Ready to squat';
        feedbackType = 'good';
    }

    updateFeedback(feedback, feedbackType);

    // Rep counting
    if (kneeAngle < 100 && lastSquatState === 'up') {
        lastSquatState = 'down';
    } else if (kneeAngle > 150 && lastSquatState === 'down') {
        lastSquatState = 'up';
        repCount++;
        updateRepCounter();
    }
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

function updateFeedback(message, type = 'good') {
    feedbackText.textContent = message;
    feedbackText.className = type;
}

function updateRepCounter() {
    repCounter.textContent = `Reps: ${repCount}`;
}

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener('load', () => {
    initializePose();
    startCamera();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
    }
});
