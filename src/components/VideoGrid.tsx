import { sfuSocket } from "@/hooks/use-call";
import { MicOff, Speaker, VideoOff, Volume2 } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
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

export const VideoGrid = ({ streams, isVideoOff, isMuted, speakingPeers, isSpeaking }: { streams: { id: string; stream: MediaStream }[], isVideoOff: boolean, isMuted: boolean, speakingPeers: string[], isSpeaking: boolean }) => {
  const [streamMetadata, setStreamMetadata] = useState<StreamMetadata>({});
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  const streamMapRef = useRef<Map<string, MediaStream>>(new Map());

  const attachMediaStream = useCallback((id: string, stream: MediaStream) => {
    const videoElement = videoRefs.current[id];
    if (videoElement && videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
    }
  }, []);

  useEffect(() => {
    streams.forEach(({ id, stream }) => {
      streamMapRef.current.set(id, stream);
      attachMediaStream(id, stream);
    });
  }, [streams, attachMediaStream]);

  useEffect(() => {
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

      if (metadata.type === 'screen' || streamId.includes('screen')) {
        setActiveStream(streamId);
      }
    });

    return () => {
      sfuSocket.off('sfu:stream-updated');
    };
  }, []);

  useEffect(() => {
    const screenStream = streams.find(s => s.id.includes('screen') ||
      streamMetadata[s.id]?.metadata?.type === 'screen');

    if (screenStream && !activeStream) {
      setActiveStream(screenStream.id);
    }

    if (activeStream && !streams.find(s => s.id === activeStream)) {
      setActiveStream(null);
    }
  }, [streams, streamMetadata, activeStream]);

  const getParticipantStatus = (participantId: string) => {
    if (participantId === 'local') {
      return {
        videoOff: isVideoOff,
        micOff: isMuted,
      };
    }

    const participantStream = Object.values(streamMetadata).filter(
      stream => stream.publisherId === participantId.split('-')[1]
    );
    let videoOff = false;
    let micOff = false;

    if (participantStream.length > 0) {
      participantStream.forEach(stream => {
        if (stream.metadata.type === "webcam") {
          videoOff = !stream.metadata.video;
        }
        if (stream.metadata.type === "mic") {
          micOff = !stream.metadata.audio;
        }
      });
      return {
        videoOff,
        micOff
      };
    }

    return {
      videoOff: false,
      micOff: false,
    };
  };

  const isScreenShare = (streamId: string) => {
    return streamId.includes('screen') ||
      streamMetadata[streamId]?.metadata?.type === 'screen';
  };

  const sortedStreams = activeStream
    ? [
      ...streams.filter(s => s.id === activeStream),
      ...streams.filter(s => s.id !== activeStream)
    ]
    : streams;

  const getGridColsClass = () => {
    const count = sortedStreams.filter(s => !s.id.includes('audio') && !s.id.includes('mic')).length;

    if (isMobile) return 'grid-cols-1';
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-3';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  const randomColor = () => {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
  };

  return (
    <div className={`grid ${getGridColsClass()} gap-2 md:gap-4 h-[calc(100vh-120px)]`}>
      {sortedStreams.map((stream) => {
        // if (stream.id.includes('audio') || stream.id.includes('mic')) return null;
        // trước khi return null
        if (stream.id.includes('audio') || stream.id.includes('mic')) {
          return (
            <audio
              key={stream.id}
              ref={el => { if (el) el.srcObject = stream.stream; }}
              autoPlay
            />
          );
        }

        const { videoOff, micOff } = getParticipantStatus(stream.id);
        const isScreen = isScreenShare(stream.id);

        return (
          <div
            key={stream.id}
            className={`relative bg-gray-800 rounded-lg overflow-hidden h-full w-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500 ${activeStream ? "aspect-video" : (streams.length === 1 ? "h-full" : "aspect-video")
              }`}
            onClick={() => setActiveStream(stream.id)}
          >
            <div
              className={`relative bg-gray-800 rounded-lg overflow-hidden w-full h-full ${speakingPeers.includes(stream.id) || isSpeaking ? "border-2 border-green-500" : ""}`}
            >
              <video
                ref={el => videoRefs.current[stream.id] = el}
                autoPlay
                playsInline
                muted={stream.id === 'local' || micOff}
                className={`w-full h-full object-contain`}
                style={{ opacity: videoOff ? 0 : 1 }}
              />

              {videoOff && !isScreen && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                  <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-semibold">
                    {stream.id === 'local' ? 'B' : stream.id.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}

            </div>

            <span className="absolute bottom-2 md:bottom-4 left-2 md:left-4 text-sm md:text-base text-white bg-black/60 px-2 py-1 rounded-md">
              {isScreen ? 'Màn hình chia sẻ' : stream.id === 'local' ? 'Bạn' : stream.id.split('-')[1]}
            </span>

            <div className="absolute top-2 right-2 flex gap-2">
              {videoOff && !isScreen && (
                <div className="bg-black/60 p-1.5 rounded-full">
                  <VideoOff className="h-5 w-5 text-white" />
                </div>
              )}
              {micOff && (
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