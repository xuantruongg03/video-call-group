import { useIsMobile } from "@/hooks/use-mobile";
import { Activity, BookCheck, ChevronDown, ChevronUp, Disc2, Loader2, Lock, LockOpen, LogOut, MessageCircle, Mic, MicOff, PenLine, QrCode, ScreenShare, ScreenShareOff, UserRoundSearch, Video, Video as VideoIcon, VideoOff, Vote } from "lucide-react";
import { useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Button } from "./ui/button";

interface VideoControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleChat: () => void;
  onToggleWhiteboard: () => void;
  onToggleScreenShare: () => void;
  isScreenSharing: boolean;
  onToggleLockRoom: () => void;
  onToggleNetworkMonitor: () => void;
  onToggleVoting: () => void;
  onToggleQuiz: () => void;
  onToggleRecording: () => void;
  onLeaveRoom: () => void;
  isRecording: boolean;
  isProcessing: boolean;
  onShowQRCode: () => void;
  onToggleBehaviorMonitoring: () => void;
  isCreator?: boolean;
  isMonitorActive?: boolean;
}

export const VideoControls = ({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onToggleChat,
  onToggleWhiteboard,
  onToggleScreenShare,
  isScreenSharing,
  onToggleLockRoom,
  onToggleNetworkMonitor,
  onToggleVoting,
  onToggleQuiz,
  onToggleRecording,
  onLeaveRoom,
  isRecording,
  isProcessing,
  onShowQRCode,
  onToggleBehaviorMonitoring,
  isCreator = false,
  isMonitorActive = false,
}: VideoControlsProps) => {
  const room = useSelector((state: any) => state.room);
  const isMobile = useIsMobile();
  const [showControls, setShowControls] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (!showControls) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setShowControls(true)}
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-lg z-50"
      >
        <ChevronUp className="h-5 w-5" />
      </Button>
    );
  }

  const controlButtons = [
    {
      key: "ghost",
      title: "Ẩn bảng điều khiển",
      onClick: () => setShowControls(false),
      icon: <ChevronDown className="h-5 w-5" />,
      className: "bg-white hover:bg-gray-100"
    },
    ...(isCreator ? [{
      key: "behavior",
      title: "Giám sát hành vi",
      onClick: onToggleBehaviorMonitoring,
      icon: <UserRoundSearch className="h-5 w-5" />,
      className: isMonitorActive ? "bg-red-100 hover:bg-red-200" : ""
    }] : []),
    {
      key: "mute",
      title: "Tắt/bật mic",
      onClick: onToggleMute,
      icon: isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />,
      className: isMuted ? "bg-red-100 hover:bg-red-200" : ""
    },
    {
      key: "video",
      title: "Tắt/bật camera",
      onClick: onToggleVideo,
      icon: isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />,
      className: isVideoOff ? "bg-red-100 hover:bg-red-200" : ""
    },
    {
      key: "screen",
      title: "Chia sẻ màn hình",
      onClick: onToggleScreenShare,
      icon: isScreenSharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />,
      className: isScreenSharing ? "bg-green-100 hover:bg-green-200" : ""
    },
    {
      key: "record",
      title: "Ghi hình",
      onClick: isProcessing ? undefined : onToggleRecording,
      icon: isProcessing ?
        <Loader2 className="h-5 w-5 animate-spin" /> :
        (isRecording ? <Disc2 className="h-5 w-5" color="red" /> : <VideoIcon className="h-5 w-5" />),
      className: isProcessing ? "bg-yellow-100 cursor-not-allowed" :
        (isRecording ? "bg-red-100 hover:bg-red-200" : "")
    },
    {
      key: "whiteboard",
      title: "Bảng trắng",
      onClick: onToggleWhiteboard,
      icon: <PenLine className="h-5 w-5" />,
      className: ""
    },
    {
      key: "qrcode",
      onClick: onShowQRCode,
      icon: <QrCode className="h-5 w-5" />,
      className: ""
    },
    {
      key: "lock",
      title: "Khóa/Mở phòng",
      onClick: onToggleLockRoom,
      icon: room.isLocked ? <Lock className="h-5 w-5" /> : <LockOpen className="h-5 w-5" />,
      className: ""
    },
    {
      key: "network",
      title: "Giám sát mạng",
      onClick: onToggleNetworkMonitor,
      icon: <Activity className="h-5 w-5" />,
      className: ""
    },
    {
      key: "voting",
      title: "Bỏ phiếu",
      onClick: onToggleVoting,
      icon: <Vote className="h-5 w-5" />,
      className: ""
    },
    {
      key: "quiz",
      title: "Bài kiểm tra",
      onClick: onToggleQuiz,
      icon: <BookCheck className="h-5 w-5" />,
      className: ""
    },
    {
      key: "chat",
      title: "Trò chuyện văn bản",
      onClick: onToggleChat,
      icon: <MessageCircle className="h-5 w-5" />,
      className: ""
    },
    {
      key: "leave",
      title: "Rời phòng",
      onClick: onLeaveRoom,
      icon: <LogOut className="h-5 w-5" />,
      className: "bg-red-500 hover:bg-red-600 text-white",
      variant: "destructive" as const
    }
  ];

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-white p-3 rounded-full shadow-lg z-50">
      <div
        ref={scrollContainerRef}
        className={isMobile ? "flex items-center gap-2 overflow-x-auto snap-x snap-mandatory max-w-[300px] no-scrollbar" : "flex items-center gap-4"}
      >
        {controlButtons.map((button, index) => (
          <div key={button.key} className="snap-start">
            <Button
              variant={button.variant || "outline"}
              size="icon"
              title={button.title}
              onClick={button.onClick}
              className={button.className}
              disabled={button.onClick === undefined}
            >
              {button.icon}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
