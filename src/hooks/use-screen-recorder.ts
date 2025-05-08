import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useConvertVideo from "./use-convert-video";

export const useScreenRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataRequestIntervalRef = useRef<number | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(
    null
  );
  const audioSourcesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  const { convertVideoMutation, isPending: isConverting } = useConvertVideo();

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }

      if (audioContextRef.current) {
        audioSourcesRef.current.forEach((source) => {
          try {
            source.disconnect();
          } catch (e) {
            console.error("Error disconnecting audio source:", e);
          }
        });

        if (audioDestinationRef.current) {
          try {
            audioDestinationRef.current.disconnect();
          } catch (e) {
            console.error("Error disconnecting audio destination:", e);
          }
        }

        if (audioContextRef.current.state !== "closed") {
          try {
            audioContextRef.current.close();
          } catch (e) {
            console.error("Error closing audio context:", e);
          }
        }
      }
    };
  }, []);

  // Check browser support
  useEffect(() => {
    const checkSupport = () => {
      if (!window.MediaRecorder) {
        setIsSupported(false);
        return false;
      }
      return true;
    };

    checkSupport();
  }, []);

  const findMediaStreamsInObject = (
    obj: any,
    path: string = "",
    maxDepth: number = 3,
    currentDepth: number = 0
  ): { stream: MediaStream; path: string }[] => {
    if (currentDepth > maxDepth) return [];
    if (!obj || typeof obj !== "object") return [];

    const results: { stream: MediaStream; path: string }[] = [];

    try {
      if (obj instanceof MediaStream) {
        if (obj.getAudioTracks().length > 0) {
          results.push({ stream: obj, path });
        }
        return results;
      }

      if (obj instanceof Node || typeof obj === "function") return [];

      for (const key in obj) {
        try {
          const value = obj[key];
          if (value instanceof MediaStream) {
            if (value.getAudioTracks().length > 0) {
              results.push({
                stream: value,
                path: path ? `${path}.${key}` : key,
              });
            }
          } else if (
            value &&
            typeof value === "object" &&
            !(value instanceof Node)
          ) {
            const childResults = findMediaStreamsInObject(
              value,
              path ? `${path}.${key}` : key,
              maxDepth,
              currentDepth + 1
            );
            results.push(...childResults);
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error("Error in findMediaStreamsInObject:", e);
    }

    return results;
  };

  const createCanvasStream = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = 1280;
      canvasRef.current.height = 720;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    const canvasStream = canvas.captureStream(60);

    try {
      if (audioContextRef.current) {
        audioSourcesRef.current.forEach((source) => source.disconnect());
        if (audioDestinationRef.current)
          audioDestinationRef.current.disconnect();
        if (audioContextRef.current.state !== "closed")
          audioContextRef.current.close();
      }

      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        latencyHint: "interactive",
        sampleRate: 48000,
      });

      audioDestinationRef.current =
        audioContextRef.current.createMediaStreamDestination();
      audioSourcesRef.current = [];

      const allAudioSources = [];

      const allVideos = document.querySelectorAll("video");
      allVideos.forEach((video, index) => {
        if (video.srcObject instanceof MediaStream) {
          const audioTracks = video.srcObject.getAudioTracks();
          if (audioTracks.length > 0) {
            allAudioSources.push({
              stream: video.srcObject,
              type: "video",
              id: video.id || `video-${index}`,
            });
          }
        }
      });

      const allAudios = document.querySelectorAll("audio");

      allAudios.forEach((audio, index) => {
        if (audio.srcObject instanceof MediaStream) {
          const audioTracks = audio.srcObject.getAudioTracks();
          if (audioTracks.length > 0) {
            console.log(
              `Audio ${index} has ${audioTracks.length} audio tracks`
            );
            allAudioSources.push({
              stream: audio.srcObject,
              type: "audio",
              id: audio.id || `audio-${index}`,
            });
          }
        }
      });

      try {
        const globalStreams = findMediaStreamsInObject(window);
        globalStreams.forEach(({ stream, path }) => {
          allAudioSources.push({
            stream,
            type: "global",
            id: path,
          });
        });
      } catch (e) {
        console.error("Error searching for global MediaStreams:", e);
      }

      if (allAudioSources.length > 0) {
        allAudioSources.forEach((source, index) => {
          try {
            const audioSource =
              audioContextRef.current!.createMediaStreamSource(source.stream);
            audioSource.connect(audioDestinationRef.current!);
            audioSourcesRef.current.push(audioSource);
          } catch (e) {
            console.error(`Error connecting audio source ${index}:`, e);
          }
        });

        audioDestinationRef
          .current!.stream.getAudioTracks()
          .forEach((track) => {
            try {
              canvasStream.addTrack(track);
            } catch (e) {
              console.error("Error adding combined audio track:", e);
            }
          });
      } else {
        console.warn("No audio sources found to mix");
      }
    } catch (e) {
      console.error("Error setting up audio mixing:", e);
    }

    const drawTestPattern = () => {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#1f1f1f");
      gradient.addColorStop(1, "#2a2a2a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    
      const logo = new Image();
      logo.src = "/src/access/logo.png";
      logo.onload = () => {
        const iconSize = 30;
        const text = "VideoMeet";
        ctx.font = "24px Arial";
        const textWidth = ctx.measureText(text).width;
        const totalWidth = iconSize + 10 + textWidth;
    
        const x = (canvas.width - totalWidth) / 2;
        const y = canvas.height / 2;
    
        ctx.drawImage(logo, x, y - iconSize / 2, iconSize, iconSize);
    
        ctx.fillStyle = "white";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x + iconSize + 10, y);
    
        // Vẽ thời gian bên dưới
        ctx.textAlign = "center";
        ctx.font = "18px Arial";
        ctx.fillText(new Date().toLocaleTimeString(), canvas.width / 2, y + 40);
      };
    };
    
    drawTestPattern();

    const allVideosForDrawing = document.querySelectorAll("video");
    const waitForVideos = () => {
      let allReady = true;
      allVideosForDrawing.forEach((video) => {
        if (video.readyState < 2) {
          allReady = false;
        }
      });

      if (!allReady) {
        setTimeout(waitForVideos, 100);
      } else {
        console.log("All videos are ready!");
      }
    };

    waitForVideos();

    const drawVideoToCanvas = () => {
      ctx.fillStyle = "#f9fafb"; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const videoGridSelectors = [
        ".video-grid",
        ".call-container",
        "[data-video-container]",
      ];
      let videoGrid = null;

      for (const selector of videoGridSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          videoGrid = element;
          break;
        }
      }

      const streamTilesSelectors = [".participant-container"];
      let streamTiles = [];

      for (const selector of streamTilesSelectors) {
        const elements = videoGrid.querySelectorAll(selector);
        if (elements.length > 0) {
          streamTiles = Array.from(elements);
          break;
        }
      }

      if (streamTiles.length === 0) {
        console.warn(
          "No stream tiles found, trying to find videos directly in grid"
        );
        toast.error("Không tìm thấy video để ghi lại, vui lòng kiểm tra lại");
        setIsRecording(false);
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
        }
        return;
      }

      let minLeft = Infinity,
        minTop = Infinity;
      let maxRight = -Infinity,
        maxBottom = -Infinity;

      streamTiles.forEach((tile) => {
        const rect = tile.getBoundingClientRect();
        minLeft = Math.min(minLeft, rect.left);
        minTop = Math.min(minTop, rect.top);
        maxRight = Math.max(maxRight, rect.right);
        maxBottom = Math.max(maxBottom, rect.bottom);
      });

      const layoutWidth = maxRight - minLeft;
      const layoutHeight = maxBottom - minTop;

      const scaleX = canvas.width / layoutWidth;
      const scaleY = canvas.height / layoutHeight;
      const scale = Math.min(scaleX, scaleY); 

      const offsetX = (canvas.width - layoutWidth * scale) / 2;
      const offsetY = (canvas.height - layoutHeight * scale) / 2;

      let drawnVideos = 0;
      streamTiles.forEach((container, index) => {
        let video = container.querySelector("video");

        if (!video && container instanceof HTMLVideoElement) {
          video = container;
        }
        const rect = container.getBoundingClientRect();
        const x = offsetX + (rect.left - minLeft) * scale;
        const y = offsetY + (rect.top - minTop) * scale;
        const width = rect.width * scale;
        const height = rect.height * scale;

        if (video && video.style.display !== "none") {
          try {
            if (
              video.readyState >= 2 &&
              video.videoWidth > 0 &&
              video.videoHeight > 0
            ) {
              try {
                ctx.drawImage(video, x, y, width, height);
                drawnVideos++;

                ctx.strokeStyle = "#00ff00";
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, width, height);
              } catch (drawErr) {
                ctx.fillStyle = "#ff0000";
                ctx.fillRect(x, y, width, height);
                ctx.fillStyle = "white";
                ctx.font = "14px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                  `Error: ${drawErr.message}`,
                  x + width / 2,
                  y + height / 2
                );
              }
            } else {
              ctx.fillStyle = "#1F2937";
              ctx.fillRect(x, y, width, height);

              ctx.fillStyle = "white";
              ctx.font = "14px Arial";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(
                `Loading video... (state: ${video.readyState})`,
                x + width / 2,
                y + height / 2
              );
            }

            const isSpeaking = container.classList.contains("speaking");
            if (isSpeaking) {
              ctx.strokeStyle = "#22c55e";
              ctx.lineWidth = 4;
              ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
            }
          } catch (e) {
            ctx.fillStyle = "#ff0000";
            ctx.fillRect(x, y, width, height);
            ctx.fillStyle = "white";
            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`Error: ${e.message}`, x + width / 2, y + height / 2);
          }
        } else {
          ctx.fillStyle = "#1F2937"; // bg-gray-800
          ctx.fillRect(x, y, width, height);

          const avatarElement = container.querySelector(".rounded-full");
          if (avatarElement) {
            ctx.fillStyle = "#3B82F6"; // bg-blue-500
            const circleX = x + width / 2;
            const circleY = y + height / 2;
            const radius = Math.min(width, height) * 0.15;
            ctx.beginPath();
            ctx.arc(circleX, circleY, radius, 0, Math.PI * 2);
            ctx.fill();

            const initialElement = avatarElement.textContent?.trim();
            if (initialElement) {
              ctx.fillStyle = "white";
              ctx.font = `bold ${radius}px Arial`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(initialElement, circleX, circleY);
            }
          }
        }

        const nameElement = container.querySelector(".participant-name");
        if (nameElement && nameElement.textContent) {
          const name = nameElement.textContent;
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.fillRect(x, y + height - 25, width, 25);
          ctx.fillStyle = "white";
          ctx.font = "12px Arial";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(name, x + 10, y + height - 12);
        }

        const micOffIcon = container.querySelector(".bg-black\\/60");
        if (micOffIcon && micOffIcon.querySelector(".lucide-mic-off")) {
          const iconX = x + width - 30;
          const iconY = y + 10;
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.fillRect(iconX, iconY, 20, 20);

          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(iconX + 5, iconY + 15);
          ctx.lineTo(iconX + 15, iconY + 5);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(iconX + 10, iconY + 10, 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      if (drawnVideos === 0) {
        drawTestPattern();
      }

      const now = new Date();
      const timeString = now.toLocaleTimeString();
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(canvas.width - 100, 10, 90, 20);
      ctx.fillStyle = "white";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(timeString, canvas.width - 55, 23);

      animationFrameRef.current = requestAnimationFrame(drawVideoToCanvas);
    };

    animationFrameRef.current = requestAnimationFrame(drawVideoToCanvas);

    return canvasStream;
  }, [isRecording]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      toast.error("Trình duyệt của bạn không hỗ trợ ghi màn hình");
      return;
    }

    try {
      setIsRecording(true);
      const stream = createCanvasStream();

      if (stream.getTracks().length === 0) {
        throw new Error("No tracks in stream");
      }

      streamRef.current = stream;

      const supportedMimeTypes = [
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9,opus",
        "video/webm",
        "video/mp4",
      ];

      let selectedMimeType = "";
      for (const mimeType of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log(`Selected MIME type: ${selectedMimeType}`);
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error("No supported MIME types found");
      }

      const hasAudioTracks = stream.getAudioTracks().length > 0;
      if (!hasAudioTracks) {
        console.warn(
          "No audio tracks found in stream. Recording may not have audio."
        );
        toast.warning(
          "Không tìm thấy nguồn âm thanh. Video có thể không có âm thanh."
        );

        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              channelCount: 2,
            },
            video: false,
          });

          if (audioStream && audioStream.getAudioTracks().length > 0) {
            audioStream.getAudioTracks().forEach((track) => {
              stream.addTrack(track);
            });
          } 
        } catch (audioErr) {
          console.error("Failed to get system audio:", audioErr);
        }
      } else {
        console.log("Audio tracks found, recording should have audio");
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: hasAudioTracks ? 128000 : 0,
      });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        toast.error(
          "Lỗi trong quá trình ghi: " +
            (event.error?.message || "Không xác định")
        );
        setIsRecording(false);
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
        }
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        } else {
          console.warn("Received empty data chunk");
        }
      };

      mediaRecorder.onstart = () => {
        const videoGrid = document.querySelector(".video-grid");
        if (videoGrid) {
          
        }
      };

      mediaRecorder.onstop = async () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        if (recordedChunksRef.current.length === 0) {
          toast.error("Không có dữ liệu video được ghi lại");
          setIsRecording(false);
          setIsProcessing(false);
          return;
        }

        const webmBlob = new Blob(recordedChunksRef.current, {
          type: selectedMimeType,
        });

        if (webmBlob.size < 100) {
          toast.error("Video ghi được quá nhỏ, có thể đã xảy ra lỗi");
          setIsRecording(false);
          setIsProcessing(false);
          return;
        }

        try {
          setIsProcessing(true);
          toast.loading("Đang xử lý video...", { id: "processing-video" });
          
          const formData = new FormData();
          formData.append('file', webmBlob, 'recording.webm');
          await convertVideoMutation(formData)
          .then(response => {
            toast.dismiss("processing-video");
            
            const bufferData = response.data.data;
            const uint8Array = new Uint8Array(bufferData.data);
            const mp4Blob = new Blob([uint8Array], {type: 'video/mp4'});
            
            const url = URL.createObjectURL(mp4Blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `meeting-recording-${new Date().toISOString()}.mp4`;
            a.click();
            
            setTimeout(() => {
              URL.revokeObjectURL(url);
            }, 100);
            
            toast.success("Đã lưu bản ghi cuộc họp (MP4)");
          });

          setTimeout(() => {
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((track) => track.stop());
              streamRef.current = null;
            }
          }, 100);
        } catch (error) {
          console.error("Error converting video:", error);
          toast.dismiss("processing-video");
          
          toast.loading("Đang lưu dưới dạng WebM...", { id: "saving-webm" });
          const webmUrl = URL.createObjectURL(webmBlob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = webmUrl;
          a.download = `meeting-recording-${new Date().toISOString()}.webm`;
          
          document.body.appendChild(a);
          a.click();
          
          // Clean up
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(webmUrl);
          }, 100);
          
          toast.dismiss("saving-webm");
          toast.error("Không thể chuyển đổi sang MP4, đã lưu dưới dạng WebM");
        } finally {
          setIsProcessing(false);
          setIsRecording(false);
        }
      };

      if (dataRequestIntervalRef.current) {
        clearInterval(dataRequestIntervalRef.current);
      }

      // Create new interval for requesting data
      const dataRequestInterval = setInterval(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          try {
            mediaRecorderRef.current.requestData();
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext("2d");
              if (ctx) {
                const now = new Date();
                ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
                ctx.fillRect(0, 0, 10, 10);
                ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
                ctx.font = "8px Arial";
                ctx.fillText(now.getSeconds().toString(), 5, 5);
              }
            }
          } catch (e) {
            console.error("Error requesting data:", e);
          }
        } else {
          if (dataRequestIntervalRef.current) {
            clearInterval(dataRequestIntervalRef.current);
            dataRequestIntervalRef.current = null;
          }
        }
      }, 1000);

      dataRequestIntervalRef.current = dataRequestInterval as unknown as number;

      try {
        mediaRecorder.start(100); // Collect data every 100ms for more frequent captures
      } catch (error) {
        console.error("Error starting MediaRecorder:", error);
        toast.error(
          "Không thể bắt đầu MediaRecorder: " + (error as Error).message
        );
        return;
      }

      // Immediately request data to check if recording is working
      setTimeout(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          try {
            mediaRecorderRef.current.requestData();
            console.log("Initial data request sent");
          } catch (e) {
            console.error("Error on initial data request:", e);
          }
        }
      }, 200);

      setIsRecording(true);
      toast.success("Đang ghi cuộc họp", {
        duration: 3000,
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
      toast.error(
        "Không thể bắt đầu ghi cuộc họp: " + (error as Error).message
      );
    }
  }, [isSupported, createCanvasStream]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (dataRequestIntervalRef?.current) {
      clearInterval(dataRequestIntervalRef.current);
      dataRequestIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      setIsProcessing(true);
      toast.loading("Đang dừng ghi và chuẩn bị video...", { id: "stopping-recording" });
      
      if (mediaRecorderRef.current.state === "recording") {
        try {
          mediaRecorderRef.current.requestData();
          setTimeout(() => {
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.stop();
              toast.dismiss("stopping-recording");
            }

            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
            }
          }, 500);
        } catch (e) {
          console.error("Error during stop recording:", e);
          toast.dismiss("stopping-recording");
          toast.error("Lỗi khi dừng ghi: " + (e as Error).message);

          if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
          }
          setIsProcessing(false);
        }
      } else {
        mediaRecorderRef.current.stop();
        toast.dismiss("stopping-recording");
      }
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (dataRequestIntervalRef?.current) {
        clearInterval(dataRequestIntervalRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    isProcessing,

    startRecording,
    stopRecording,
    toggleRecording: () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    },
  };
};
