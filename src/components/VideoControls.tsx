
import { Mic, MicOff, Video, VideoOff, MessageCircle, LogOut, ScreenShare, ScreenShareOff, Lock, LockOpen, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import CONSTANT from "@/lib/constant";
import { sfuSocket } from "@/hooks/use-call";
interface VideoControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleChat: () => void;
  onToggleScreenShare: () => void;
  isScreenSharing: boolean;
  isLocked: boolean;
  onToggleLockRoom: () => void;
}

export const VideoControls = ({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onToggleChat,
  onToggleScreenShare,
  isScreenSharing,
  isLocked,
  onToggleLockRoom,
}: VideoControlsProps) => {
  const navigate = useNavigate();

  const handleShareScreen = () => {
    console.log("handleShareScreen");
    onToggleScreenShare();
  }

  const handleLeaveRoom = () => {
    // Clear local storage
    localStorage.removeItem(CONSTANT.USER_NAME);
    localStorage.removeItem(CONSTANT.PASSWORD);
    localStorage.removeItem(CONSTANT.IS_LOCKED);
    //Clear socket
    sfuSocket.disconnect();
    navigate('/room');
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-white p-4 rounded-full shadow-lg">
      <Button
        variant="outline"
        size="icon"
        onClick={onToggleMute}
        className={isMuted ? "bg-red-100 hover:bg-red-200" : ""}
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onToggleVideo}
        className={isVideoOff ? "bg-red-100 hover:bg-red-200" : ""}
      >
        {isVideoOff ? (
          <VideoOff className="h-5 w-5" />
        ) : (
          <Video className="h-5 w-5" />
        )}
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleShareScreen}
        className={isScreenSharing ? "bg-green-100 hover:bg-green-200" : ""}
      >
        {isScreenSharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
      </Button>
      {/* Add lock room button */}
      <Button variant="outline" size="icon" onClick={onToggleLockRoom}>
        {isLocked ? <Lock className="h-5 w-5" /> : <LockOpen className="h-5 w-5" />}
      </Button>
      <Button variant="outline" size="icon" onClick={onToggleChat}>
        <MessageCircle className="h-5 w-5" />
      </Button>
      <Button
        variant="destructive"
        size="icon"
        onClick={handleLeaveRoom}
        className="bg-red-500 hover:bg-red-600 text-white"
      >
        <LogOut className="h-5 w-5" />
      </Button>
    </div>
  );
};
