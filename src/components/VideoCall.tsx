import { useCall } from "@/hooks/use-call";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { ChatSidebar } from "./ChatSidebar";
import { ParticipantsList } from "./ParticipantsList";
import { VideoControls } from "./VideoControls";
import { VideoGrid } from "./VideoGrid";
import { LockRoomDialog } from "./Dialogs/LockRoomDialog";

interface VideoCallProps {
  roomId?: string;
}

export const VideoCall = ({ roomId }: VideoCallProps) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isShowDialogPassword, setIsShowDialogPassword] = useState(false);
  const { streams, toggleVideo, toggleAudio, toggleScreenShare, isScreenSharing, toggleLockRoom, clearConnection, speakingPeers, isSpeaking } = useCall(roomId ?? '');
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const room = useSelector((state: any) => state.room);
  
  useEffect(() => {
    if (!room.username) {
      navigate('/room');
    }
  }, [room.username]);

  const handleToggleVideo = () => {
    toggleVideo();
    setIsVideoOff(!isVideoOff);
  }

  const handleToggleAudio = () => {
    toggleAudio();
    setIsMuted(!isMuted);
  }

  const handleSetPassword = (password: string) => {
    setIsShowDialogPassword(false);
    toggleLockRoom(password);
  }

  const handleToggleLockRoom = () => {
    if (!room.isLocked) {
      setIsShowDialogPassword(true);
    } else {
      toggleLockRoom();
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 relative">
      {isShowDialogPassword && (
        <LockRoomDialog
          isOpen={isShowDialogPassword}
          onClose={() => setIsShowDialogPassword(false)}
          onSetPassword={handleSetPassword}
        />
      )}
      <div className={`flex-1 p-2 md:p-4 ${isChatOpen && !isMobile ? 'mr-[320px]' : ''}`}>
        <div className="mb-2 md:mb-4 flex items-center justify-between">
          <h2 className="text-base md:text-lg font-semibold">Room ID: {roomId}</h2>
          <ParticipantsList roomId={roomId} />
        </div>
        <VideoGrid streams={streams} isVideoOff={isVideoOff} isMuted={isMuted} speakingPeers={Array.from(speakingPeers)} isSpeaking={isSpeaking} />
        <VideoControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleMute={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
          onToggleScreenShare={toggleScreenShare}
          isScreenSharing={isScreenSharing}
          onToggleLockRoom={handleToggleLockRoom}
          clearConnection={clearConnection}
        />
      </div>
      {isChatOpen && (
        <ChatSidebar
          isOpen={isChatOpen}
          setIsOpen={setIsChatOpen}
          roomId={roomId}
        />
      )}
    </div>
  );
};
