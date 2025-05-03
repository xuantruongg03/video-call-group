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
import { sfuSocket } from "@/hooks/use-call";

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

  useEffect(() => {
    if (roomId && room.username) {
      // Lấy danh sách người tham gia khi vào phòng
      sfuSocket.emit('sfu:get-participants', { roomId });
      
      // Lập lịch lấy danh sách người tham gia định kỳ
      const interval = setInterval(() => {
        sfuSocket.emit('sfu:get-participants', { roomId });
      }, 10000); // Mỗi 10 giây
      
      return () => clearInterval(interval);
    }
  }, [roomId, room.username]);

  // Thêm useEffect để kiểm tra nếu không có camera
  useEffect(() => {
    // Kiểm tra stream local
    const localStream = streams.find(s => s.id === 'local');
    if (localStream) {
      // Check the metadata and tracks to determine camera status
      const videoTracks = localStream.stream.getVideoTracks();
      const hasVideoTracks = videoTracks.length > 0;
      const isVideoEnabled = hasVideoTracks && videoTracks[0].enabled;
      const hasCameraDisabled = localStream.metadata?.noCameraAvailable === true;
      
      // Check if camera should be shown as off
      if (hasCameraDisabled || !hasVideoTracks || !isVideoEnabled) {
        if (!isVideoOff) {
          console.log("Setting video off based on stream state");
          setIsVideoOff(true);
        }
      } else if (localStream.metadata?.video === true) {
        if (isVideoOff) {
          console.log("Setting video on based on stream state");
          setIsVideoOff(false);
        }
      }
      
      // Check audio tracks to determine mic status
      const audioTracks = localStream.stream.getAudioTracks();
      const hasAudioTracks = audioTracks.length > 0;
      const isAudioEnabled = hasAudioTracks && audioTracks[0].enabled;
      
      // Update mic mute state based on actual track state and metadata
      if (!hasAudioTracks || !isAudioEnabled || localStream.metadata?.audio === false) {
        if (!isMuted) {
          console.log("Setting audio muted based on stream state");
          setIsMuted(true);
        }
      } else if (localStream.metadata?.audio === true) {
        if (isMuted) {
          console.log("Setting audio unmuted based on stream state");
          setIsMuted(false);
        }
      }
    }
  }, [streams, isVideoOff, isMuted]);

  const handleToggleVideo = () => {
    const videoEnabled = toggleVideo();
    setIsVideoOff(!videoEnabled); // Use the returned value instead of toggling state directly
  }

  const handleToggleAudio = () => {
    const audioEnabled = toggleAudio();
    setIsMuted(!audioEnabled); // Use the returned value instead of toggling state directly
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
