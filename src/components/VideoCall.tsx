import { sfuSocket, useCall } from "@/hooks/use-call";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { ChatSidebar } from "./ChatSidebar";
import { LockRoomDialog } from "./Dialogs/LockRoomDialog";
import { NetworkMonitorDialog } from "./Dialogs/NetworkMonitorDialog";
import { SecretVotingDialog } from "./Dialogs/SecretVotingDialog";
import { ParticipantsList } from "./ParticipantsList";
import { VideoControls } from "./VideoControls";
import { VideoGrid } from "./VideoGrid";
import { Whiteboard } from "./WhiteBoard";
import { toast } from "sonner";

interface VideoCallProps {
  roomId?: string;
}

export const VideoCall = ({ roomId }: VideoCallProps) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [canToggleVideo, setCanToggleVideo] = useState(true);
  const [canToggleAudio, setCanToggleAudio] = useState(true);
  const [isShowDialogPassword, setIsShowDialogPassword] = useState(false);
  const [isNetworkMonitorOpen, setIsNetworkMonitorOpen] = useState(false);
  const [isVotingDialogOpen, setIsVotingDialogOpen] = useState(false);
  const { streams, toggleVideo, toggleAudio, toggleScreenShare, isScreenSharing, toggleLockRoom, clearConnection, speakingPeers, isSpeaking, recvTransport } = useCall(roomId ?? '');
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const room = useSelector((state: any) => state.room);

  useEffect(() => {
    if (!room.username) {
      navigate('/room');
    }
  }, [room.username]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (roomId) {
        sfuSocket.emit('sfu:leave-room', { roomId });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (roomId) {
        clearConnection();
      }
    };
  }, [roomId, clearConnection]);

  useEffect(() => {
    const localStream = streams.find(s => s.id === 'local');
    if (localStream) {
      const videoTracks = localStream.stream.getVideoTracks();
      const hasVideoTracks = videoTracks.length > 0;
      const isVideoEnabled = hasVideoTracks && videoTracks[0].enabled;
      const hasCameraDisabled = localStream.metadata?.noCameraAvailable === true;

      if (hasCameraDisabled || !hasVideoTracks || !isVideoEnabled) {
        if (!isVideoOff) {
          setIsVideoOff(true);
          setCanToggleVideo(false);
        }
      } else if (localStream.metadata?.video === true) {
        if (isVideoOff) {
          setIsVideoOff(false);
          setCanToggleVideo(true);
        }
      }

      const audioTracks = localStream.stream.getAudioTracks();
      const hasAudioTracks = audioTracks.length > 0;
      const isAudioEnabled = hasAudioTracks && audioTracks[0].enabled;

      if (!hasAudioTracks || !isAudioEnabled || localStream.metadata?.audio === false) {
        if (!isMuted) {
          setIsMuted(true);
          setCanToggleAudio(false);
        }
      } else if (localStream.metadata?.audio === true) {
        if (isMuted) {
          setIsMuted(false);
          setCanToggleAudio(false);
        }
      }
    }
  }, [streams, isVideoOff, isMuted]);

  const handleToggleVideo = () => {
    if (canToggleVideo) {
      const videoEnabled = toggleVideo();
      setIsVideoOff(!videoEnabled);
    } else {
      toast.error("Không thể chuyển trạng thái camera");
    }
  }

  const handleToggleAudio = () => {
    if (canToggleAudio) {
      const audioEnabled = toggleAudio();
      setIsMuted(!audioEnabled);
    } else {
      toast.error("Không thể chuyển trạng thái mic");
    }
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

  const handleToggleVoting = () => {
    setIsVotingDialogOpen(!isVotingDialogOpen);
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
      {isNetworkMonitorOpen && (
        <NetworkMonitorDialog
          isOpen={isNetworkMonitorOpen}
          onClose={() => setIsNetworkMonitorOpen(false)}
          transport={recvTransport}
        />
      )}
      {isVotingDialogOpen && (
        <SecretVotingDialog
          isOpen={isVotingDialogOpen}
          onClose={() => setIsVotingDialogOpen(false)}
          roomId={roomId || ''}
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
          onToggleWhiteboard={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
          onToggleScreenShare={toggleScreenShare}
          isScreenSharing={isScreenSharing}
          onToggleLockRoom={handleToggleLockRoom}
          onToggleNetworkMonitor={() => setIsNetworkMonitorOpen(!isNetworkMonitorOpen)}
          onToggleVoting={handleToggleVoting}
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
      <Whiteboard roomId={roomId} isOpen={isWhiteboardOpen} onClose={() => setIsWhiteboardOpen(false)} />
    </div>
  );
};
