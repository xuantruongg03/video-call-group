import { MicOff, VideoOff } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { ActionVideoType } from "@/interfaces/action";

interface StreamTileProps {
  stream: { id: string; stream: MediaStream; metadata?: any };
  isSpeaking: boolean;
  videoOff: boolean;
  micOff: boolean;
  userName: string;
  isScreen: boolean;
  isActive: boolean;
  onClick: () => void;
  audioStream?: MediaStream;
}

export const StreamTile = ({
  stream,
  isSpeaking,
  videoOff,
  micOff,
  userName,
  isScreen,
  isActive,
  onClick,
  audioStream,
}: StreamTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    if (videoRef.current && stream.stream) {
      videoRef.current.srcObject = stream.stream;
      
      if (stream.id === 'local' && videoRef.current) {
        dispatch({
          type: ActionVideoType.SET_LOCAL_VIDEO_REF,
          payload: { localVideoRef: videoRef.current }
        });
      }
    }

    return () => {
      if (stream.id === 'local') {
        dispatch({ type: ActionVideoType.CLEAR_LOCAL_VIDEO_REF });
      }
    };
  }, [stream.stream, stream.id, dispatch]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={`relative bg-gray-800 rounded-md overflow-hidden flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-blue-500 w-full h-full`}
    >
      <div
        className={`relative bg-gray-800 w-full h-full rounded-md overflow-hidden ${
          isSpeaking ? "ring-1 ring-green-500" : ""
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ display: videoOff ? "none" : "block" }}
        />

        {audioStream && (
          <audio
            className="hidden"
            autoPlay
            ref={(el) => {
              if (el) el.srcObject = audioStream;
            }}
          />
        )}

        {videoOff && !isScreen && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500 mx-auto flex items-center justify-center text-white text-xl font-semibold mb-1">
                {userName.charAt(0).toUpperCase()}
              </div>
              <p className="text-white text-base font-medium">{userName}</p>
            </div>
          </div>
        )}
      </div>

      <span className="absolute bottom-2 left-2 text-xs text-white bg-black/60 px-1.5 py-0.5 rounded">
        {isScreen ? "Chia sẻ màn hình" : userName}
        {(audioStream || isScreen) && <span className="ml-1">🔊</span>}
      </span>

      <div className="absolute top-1 right-1 flex gap-1">
        {videoOff && !isScreen && (
          <div className="bg-black/60 p-1 rounded">
            <VideoOff className="h-4 w-4 text-white" />
          </div>
        )}
        {micOff && !audioStream && (
          <div className="bg-black/60 p-1 rounded z-20">
            <MicOff className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
    </motion.div>
  );
};
