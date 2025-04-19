import { sfuSocket } from "@/hooks/use-call";
import { MicOff, VideoOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface StreamMetadata {
  [streamId: string]: {
    publisherId: string;
    metadata: {
      video: boolean;
      audio: boolean;
      type?: string;
    }
  }
}

export const VideoGrid = ({ streams, isVideoOff, isMuted }: { streams: { id: string; stream: MediaStream }[], isVideoOff: boolean, isMuted: boolean }) => {
  const [streamMetadata, setStreamMetadata] = useState<StreamMetadata>({});
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const isMobile = useIsMobile();
  useEffect(() => {
    // Listen for stream updates from SFU
    sfuSocket.on('sfu:stream-updated', ({ streamId, publisherId, metadata }: 
      { streamId: string, publisherId: string, metadata: any }
    ) => {
      setStreamMetadata(prev => ({
        ...prev,
        [streamId]: {
          publisherId,
          metadata
        }
      }));
      
      // Auto-focus screen share streams when they appear
      if (metadata.type === 'screen' || streamId.includes('screen')) {
        setActiveStream(streamId);
      }
    });
    
    return () => {
      sfuSocket.off('sfu:stream-updated');
    };
  }, []);
  
  // Auto-focus screen share streams when they appear in streams array
  useEffect(() => {
    const screenStream = streams.find(s => s.id.includes('screen') || 
      streamMetadata[s.id]?.metadata?.type === 'screen');
    
    if (screenStream && !activeStream) {
      setActiveStream(screenStream.id);
    }
    
    // If active stream no longer exists, reset it
    if (activeStream && !streams.find(s => s.id === activeStream)) {
      setActiveStream(null);
    }
  }, [streams, streamMetadata]);
  
  const getGridLayout = () => {
    const count = streams.length;
    
    // If we have an active stream (screen share), use a different layout
    if (activeStream) {
      return "grid-cols-1";
    }
    
    if (count === 1) {
      return "grid-cols-1"; 
    }
    if (count === 2) {
      return "grid-cols-1 md:grid-cols-2"; 
    }
    if (count <= 4) {
      return "grid-cols-2"; 
    }
    if (count <= 9) {
      return "grid-cols-2 md:grid-cols-3"; 
    }
    return "grid-cols-3 md:grid-cols-4"; 
  };

  // Helper function to get video/audio status for a participant
  const getParticipantStatus = (participantId: string) => {
    // For local user, use the props directly
    if (participantId === 'local') {
      return {
        videoOff: isVideoOff,
        muted: isMuted
      };
    }
    
    // For remote users, check metadata
    const participantStream = Object.values(streamMetadata).find(
      stream => stream.publisherId === participantId
    );
    
    if (participantStream) {
      return {
        videoOff: !participantStream.metadata.video,
        muted: !participantStream.metadata.audio
      };
    }
    
    // Default if no metadata found
    return {
      videoOff: false,
      muted: false
    };
  };

  // Check if a stream is a screen share
  const isScreenShare = (streamId: string) => {
    return streamId.includes('screen') || 
      streamMetadata[streamId]?.metadata?.type === 'screen';
  };

  // Filter streams: first active stream (if any), then all other streams
  const sortedStreams = activeStream 
    ? [
        ...streams.filter(s => s.id === activeStream), 
        ...streams.filter(s => s.id !== activeStream)
      ]
    : streams;

    const getGridColsClass = () => {
      const count = sortedStreams.length;
      
      if (isMobile) return 'grid-cols-1';
      if (count === 1) return 'grid-cols-1';
      if (count === 2) return 'grid-cols-2';
      if (count === 3) return 'grid-cols-3';
      if (count <= 9) return 'grid-cols-3';
      return 'grid-cols-4';
    };

  return (
    <div className={`grid ${getGridColsClass()} gap-2 md:gap-4 h-[calc(100vh-120px)]`}>
      {sortedStreams.map((stream) => {
        const { videoOff, muted } = getParticipantStatus(stream.id);
        const isScreen = isScreenShare(stream.id);
        
        return (
          <div
            key={stream.id}
            className={`relative bg-gray-800 rounded-lg overflow-hidden h-full w-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500 ${
              activeStream ? "aspect-video" : (streams.length === 1 ? "h-full" : "aspect-video")
            }`}
            onClick={() => setActiveStream(stream.id)}
          >
            {videoOff && !isScreen ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-semibold">
                  {stream.id === 'local' ? 'B' : stream.id.charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              <video
                ref={el => {
                  if (el) {
                    el.srcObject = stream.stream;
                  }
                }}
                autoPlay
                playsInline
                className={`bg-black w-full h-full`}
                muted={stream.id === 'local'}
              />
            )}
            
            <span className="absolute bottom-2 md:bottom-4 left-2 md:left-4 text-sm md:text-base text-white bg-black/60 px-2 py-1 rounded-md">
              {isScreen ? 'Màn hình chia sẻ' : stream.id === 'local' ? 'Bạn' : stream.id}
            </span>
            
            {/* Display mute/video-off icons for all participants */}
            <div className="absolute top-2 right-2 flex gap-2">
              {videoOff && !isScreen && (
                <div className="bg-black/60 p-1.5 rounded-full">
                  <VideoOff className="h-5 w-5 text-white" />
                </div>
              )}
              {muted && (
                <div className="bg-black/60 p-1.5 rounded-full">
                  <MicOff className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
