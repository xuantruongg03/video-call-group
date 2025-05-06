import { ChevronDown, ChevronUp, Lock, LockOpen, LogOut, MessageCircle, Mic, MicOff, PenLine, ScreenShare, ScreenShareOff, Video, VideoOff, Activity } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useRef, useState } from "react";

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
  clearConnection: () => void;
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
  clearConnection,
}: VideoControlsProps) => {
  const navigate = useNavigate();
  const room = useSelector((state: any) => state.room);
  const isMobile = useIsMobile();
  const [showControls, setShowControls] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleLeaveRoom = () => {
    clearConnection();
    navigate('/room');
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setScrollLeft(scrollContainerRef.current.scrollLeft);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

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
      onClick: () => setShowControls(false),
      icon: <ChevronDown className="h-5 w-5" />,
      className: "bg-white hover:bg-gray-100"
    },
    {
      key: "mute",
      onClick: onToggleMute,
      icon: isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />,
      className: isMuted ? "bg-red-100 hover:bg-red-200" : ""
    },
    {
      key: "video",
      onClick: onToggleVideo,
      icon: isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />,
      className: isVideoOff ? "bg-red-100 hover:bg-red-200" : ""
    },
    {
      key: "screen",
      onClick: onToggleScreenShare,
      icon: isScreenSharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />,
      className: isScreenSharing ? "bg-green-100 hover:bg-green-200" : ""
    },
    {
      key: "whiteboard",
      onClick: onToggleWhiteboard,
      icon: <PenLine className="h-5 w-5" />,
      className: ""
    },
    {
      key: "lock",
      onClick: onToggleLockRoom,
      icon: room.isLocked ? <Lock className="h-5 w-5" /> : <LockOpen className="h-5 w-5" />,
      className: ""
    },
    {
      key: "network",
      onClick: onToggleNetworkMonitor,
      icon: <Activity className="h-5 w-5" />,
      className: ""
    },
    {
      key: "chat",
      onClick: onToggleChat,
      icon: <MessageCircle className="h-5 w-5" />,
      className: ""
    },
    {
      key: "leave",
      onClick: handleLeaveRoom,
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
              onClick={button.onClick}
              className={button.className}
            >
              {button.icon}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
