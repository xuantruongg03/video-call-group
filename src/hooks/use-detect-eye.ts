import * as faceMesh from "@mediapipe/face_mesh";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

export default function useDetectEye() {
  const [isLookingAtScreen, setIsLookingAtScreen] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const requestRef = useRef<number>();
  const lostFrames = useRef(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isEyeClosed, setIsEyeClosed] = useState(false);
  const [isEyeOpen, setIsEyeOpen] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const localVideoRef = useSelector((state: any) => state.video.localVideoRef);

  useEffect(() => {
    if (!localVideoRef) {
      return;
    }

    const video = localVideoRef;
    if (!video.srcObject) {
      return;
    }

    const videoTracks = (video.srcObject as MediaStream)?.getVideoTracks()[0];
    if (!videoTracks) {
      setHasCamera(false);
      return;
    }

    setHasCamera(true);

    setIsInitialized(true);

    const faceMeshDetector = new faceMesh.FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMeshDetector.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMeshDetector.onResults((results) => {
      if (results.multiFaceLandmarks?.[0]) {
        const landmarks = results.multiFaceLandmarks[0];

        const leftEye = landmarks[159];
        // const leftEye = landmarks[468];
        const rightEye = landmarks[386];
        // const rightEye = landmarks[473];
        const nose = landmarks[1];

        const avgEyeY = (leftEye.y + rightEye.y) / 2;
        const avgEyeX = (leftEye.x + rightEye.x) / 2;

        const isVerticallyCentered = Math.abs(avgEyeY - nose.y) < 0.03;
        const isHorizontallyCentered = Math.abs(avgEyeX - nose.x) < 0.03;
        const isCentered = isVerticallyCentered && isHorizontallyCentered;

        if (isCentered) {
          lostFrames.current = 0;
          setIsLookingAtScreen(true);
        } else {
          lostFrames.current++;
          if (lostFrames.current > 3) setIsLookingAtScreen(false);
        }
      } else {
        lostFrames.current++;
        if (lostFrames.current > 3) setIsLookingAtScreen(false);
      }
    });

    async function detectLoop() {
      if (!video || video.readyState !== 4) {
        requestRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      const canvasEl = canvas.current;
      canvasEl.width = video.videoWidth;
      canvasEl.height = video.videoHeight;
      const ctx = canvasEl.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvasEl.width, canvasEl.height);
        await faceMeshDetector.send({ image: canvasEl });
      }

      requestRef.current = requestAnimationFrame(detectLoop);
    }

    detectLoop();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [localVideoRef]);

  return {
    isLookingAtScreen,
    isInitialized,
    isEyeClosed,
    isEyeOpen,
    hasCamera,
  };
}
