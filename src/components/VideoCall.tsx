import useBehaviorMonitor from "@/hooks/use-behavior-monitor";
import { sfuSocket, useCall } from "@/hooks/use-call";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScreenRecorder } from "@/hooks/use-screen-recorder";
import { ActionLogType } from "@/interfaces/action";
import { TypeUserEvent } from "@/interfaces/behavior";
import { Disc2, Loader2, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChatSidebar } from "./ChatSidebar";
import { LockRoomDialog } from "./Dialogs/LockRoomDialog";
import { NetworkMonitorDialog } from "./Dialogs/NetworkMonitorDialog";
import { QRCodeDialog } from "./Dialogs/QRCodeDialog";
import { SecretVotingDialog } from "./Dialogs/SecretVotingDialog";
import { ParticipantsList } from "./ParticipantsList";
import { QuizSidebar } from "./QuizSidebar";
import { VideoControls } from "./VideoControls";
import { VideoGrid } from "./VideoGrid";
import { Whiteboard } from "./WhiteBoard";
import { Button } from "./ui/button";

interface VideoCallProps {
  roomId?: string;
}

export const VideoCall = ({ roomId }: VideoCallProps) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isQRCodeOpen, setIsQRCodeOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [canToggleVideo, setCanToggleVideo] = useState(true);
  const [canToggleAudio, setCanToggleAudio] = useState(true);
  const [isShowDialogPassword, setIsShowDialogPassword] = useState(false);
  const [isNetworkMonitorOpen, setIsNetworkMonitorOpen] = useState(false);
  const [isVotingDialogOpen, setIsVotingDialogOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStage, setInitStage] = useState<string>("Khởi tạo kết nối...");
  const { isRecording, isProcessing, toggleRecording } = useScreenRecorder();
  const { 
    streams, 
    toggleVideo, 
    toggleAudio, 
    toggleScreenShare, 
    isScreenSharing, 
    toggleLockRoom, 
    clearConnection, 
    speakingPeers, 
    isSpeaking, 
    recvTransport, 
    togglePinUser,
    isConnected,
    isJoined
  } = useCall(roomId ?? '');
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const room = useSelector((state: any) => state.room);
  const dispatch = useDispatch();
  const { sendLogsToServer, isMonitorActive, toggleBehaviorMonitoring } = useBehaviorMonitor({ roomId: roomId ?? '' });

  // Effect to update initialization status
  useEffect(() => {
    if (!isConnected) {
      setInitStage("Đang kết nối đến máy chủ...");
    } else if (!isJoined) {
      setInitStage("Đang tham gia phòng...");
    } else if (streams.length === 0) {
      setInitStage("Đang khởi tạo media...");
    } else {
      // Complete initialization after a short delay to ensure media is loaded
      const timer = setTimeout(() => {
        setIsInitializing(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isJoined, streams]);

  useEffect(() => {
    if (!room.username) {
      navigate('/room');
    }
  }, [room.username]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (roomId) {
        sendLogsToServer();
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
      dispatch({
        type: ActionLogType.SET_EVENT_LOG,
        payload: [{
          type: TypeUserEvent.CAM,
          value: videoEnabled,
          time: new Date()
        }]
      });
    } else {
      toast.error("Không thể chuyển trạng thái camera");
    }
  }

  const handleToggleAudio = () => {
    if (canToggleAudio) {
      const audioEnabled = toggleAudio();
      setIsMuted(!audioEnabled);
      dispatch({
        type: ActionLogType.SET_EVENT_LOG,
        payload: [{
          type: TypeUserEvent.MIC,
          value: audioEnabled,
          time: new Date()
        }]
      });
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
    if (isMobile) {
      if (isChatOpen) setIsChatOpen(false);
      if (isWhiteboardOpen) setIsWhiteboardOpen(false);
      if (isQuizOpen) setIsQuizOpen(false);
    }
    setIsVotingDialogOpen(!isVotingDialogOpen);
  }

  const handleToggleQuiz = () => {
    if (isMobile) {
      if (isChatOpen) setIsChatOpen(false);
      if (isWhiteboardOpen) setIsWhiteboardOpen(false);
    }
    setIsQuizOpen(!isQuizOpen);
  };

  const handleToggleChat = () => {
    if (isMobile && isQuizOpen && !isChatOpen) {
      setIsQuizOpen(false);
    }
    setIsChatOpen(!isChatOpen);
  };

  const handleToggleWhiteboard = () => {
    if (isMobile) {
      if (isChatOpen) setIsChatOpen(false);
      if (isQuizOpen) setIsQuizOpen(false);
    }
    setIsWhiteboardOpen(!isWhiteboardOpen);
  };

  const handleToggleRecording = () => {
    toggleRecording();
  };

  const handleToggleBehaviorMonitoring = () => {
    if (streams.length > 2) {
      toggleBehaviorMonitoring();
    } else {
      toast.error("Không thể bắt đầu giám sát hành vi vì có ít hơn 2 người tham gia cuộc gọi");
    }
  };

  const handleLeaveRoom = () => {
    sendLogsToServer();
    clearConnection();
    navigate('/room');
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 items-center justify-center">
        <div className="flex flex-col items-center space-y-8">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
            <div className="absolute inset-0 bg-blue-500 rounded-full opacity-30 animate-pulse"></div>
            <div className="relative bg-white rounded-full p-5 shadow-lg">
              <Loader2 className="h-14 w-14 text-blue-500 animate-spin" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-gray-800">Đang khởi tạo cuộc gọi</h2>
            <p className="text-gray-600">{initStage}</p>
          </div>
          <div className="w-72 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-progress"></div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLeaveRoom}
            className="mt-6"
          >
            Huỷ và quay lại
          </Button>
        </div>
      </div>
    );
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
      <div className={`flex-1 p-2 md:p-4 ${(isChatOpen) && !isMobile ? 'mr-[320px]' : ''}`}>
        <div className="mb-2 md:mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-semibold">Room ID: {roomId}</h2>
            <Button
              variant="outline"
              size="icon"
              title="QR Code"
              onClick={() => setIsQRCodeOpen(true)}
              className=""
            >
              <QrCode className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {isRecording && !isProcessing && (
              <div className="flex items-center gap-1 bg-red-100 px-2 py-1 rounded-full">
                <Disc2 className="h-4 w-4 fill-white animate-pulse" color="red" />
                <span className="text-xs text-red-600 font-medium">Đang ghi</span>
              </div>
            )}
            {isProcessing && (
              <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded-full">
                <Loader2 className="h-4 w-4 animate-spin" color="#f59e0b" />
                <span className="text-xs text-yellow-600 font-medium">Đang xử lý</span>
              </div>
            )}
            <ParticipantsList roomId={roomId} togglePinUser={togglePinUser} />
          </div>
        </div>
        <VideoGrid streams={streams} isVideoOff={isVideoOff} isMuted={isMuted} speakingPeers={Array.from(speakingPeers)} isSpeaking={isSpeaking} togglePinUser={togglePinUser} />
        <VideoControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleMute={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onToggleChat={handleToggleChat}
          onToggleWhiteboard={handleToggleWhiteboard}
          onToggleScreenShare={toggleScreenShare}
          isScreenSharing={isScreenSharing}
          onToggleLockRoom={handleToggleLockRoom}
          onToggleNetworkMonitor={() => setIsNetworkMonitorOpen(!isNetworkMonitorOpen)}
          onToggleVoting={handleToggleVoting}
          onToggleQuiz={handleToggleQuiz}
          onToggleRecording={handleToggleRecording}
          isRecording={isRecording}
          isProcessing={isProcessing}
          onLeaveRoom={handleLeaveRoom}
          onToggleBehaviorMonitoring={handleToggleBehaviorMonitoring}
          isCreator={room.isCreator}
          isMonitorActive={isMonitorActive}
        />
      </div>
      {isChatOpen && (
        <ChatSidebar
          isOpen={isChatOpen}
          setIsOpen={setIsChatOpen}
          roomId={roomId}
        />
      )}
      <QRCodeDialog
        isOpen={isQRCodeOpen}
        onClose={() => setIsQRCodeOpen(false)}
        roomId={roomId || ''}
      />
      {isWhiteboardOpen && (
        <Whiteboard roomId={roomId} isOpen={isWhiteboardOpen} onClose={() => setIsWhiteboardOpen(false)} />
      )}
      {isQuizOpen && (
        <QuizSidebar roomId={roomId || ''} isOpen={isQuizOpen} onClose={() => setIsQuizOpen(false)} />
      )}
    </div>
  );
};
