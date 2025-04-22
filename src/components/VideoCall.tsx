import { useEffect, useState } from "react";
import { VideoGrid } from "./VideoGrid";
import { VideoControls } from "./VideoControls";
import { ChatSidebar } from "./ChatSidebar";
import { useCall } from "@/hooks/use-call";
import CONSTANT from "@/lib/constant";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ParticipantsList } from "./ParticipantsList";
interface VideoCallProps {
  roomId?: string;
}

export const VideoCall = ({ roomId }: VideoCallProps) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const { streams, toggleVideo, toggleAudio, toggleScreenShare, isScreenSharing, toggleLockRoom, isLocked } = useCall(roomId ?? '');
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    const userName = localStorage.getItem(CONSTANT.USER_NAME);
    if (!userName) {
      navigate('/room');
    }
  }, [isLocked]);

  const handleToggleVideo = () => {
    toggleVideo();
    setIsVideoOff(!isVideoOff);
  }

  const handleToggleAudio = () => {
    toggleAudio();
    setIsMuted(!isMuted);
  }

  const handleToggleLockRoom = () => {
    if (!isLocked) {
      const password = prompt('Nhập mật khẩu để khoá phòng');
      if (password) {
        toggleLockRoom(password);
      }
    } else {
      toggleLockRoom();
    }
  }

  const mockParticipants = [
    { id: 1, name: "You" },
    { id: 2, name: "User 2" },
    { id: 3, name: "User 3" },
    { id: 4, name: "User 4" },
    { id: 5, name: "User 5" },
    { id: 6, name: "User 6" },
  ];

  return (
    <div className="flex h-screen bg-gray-50 relative">
      <div className={`flex-1 p-2 md:p-4 ${isChatOpen && !isMobile ? 'mr-[320px]' : ''}`}>
        <div className="mb-2 md:mb-4 flex items-center justify-between">
          <h2 className="text-base md:text-lg font-semibold">Room ID: {roomId}</h2>
          <ParticipantsList participants={mockParticipants} />
        </div>
        <VideoGrid streams={streams} isVideoOff={isVideoOff} isMuted={isMuted} />
        <VideoControls 
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleMute={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
          onToggleScreenShare={toggleScreenShare}
          isScreenSharing={isScreenSharing}
          isLocked={isLocked}
          onToggleLockRoom={handleToggleLockRoom}
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
