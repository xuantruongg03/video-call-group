import { useIsMobile } from "@/hooks/use-mobile";
import { MicOff, VideoOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const VideoGrid = ({ streams, isVideoOff, isMuted, speakingPeers, isSpeaking }: { 
  streams: { id: string; stream: MediaStream; metadata?: any }[], 
  isVideoOff: boolean, 
  isMuted: boolean, 
  speakingPeers: string[], 
  isSpeaking: boolean 
}) => {
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

  const getParticipantStatus = (participantId: string) => {
    if (participantId === 'local') {
      const localStream = streams.find(s => s.id === 'local');
      const metadata = localStream?.metadata;
      
      const videoTracks = localStream?.stream.getVideoTracks() || [];
      const videoEnabled = videoTracks.length > 0 && videoTracks[0].enabled;
  
      return {
        videoOff: isVideoOff, 
        micOff: isMuted, 
        noCameraAvailable: metadata?.noCameraAvailable === true || videoTracks.length === 0 || !videoEnabled
      };
    }
  
    const publisherId = participantId.startsWith('remote-') 
      ? participantId.split('-')[1] 
      : participantId.split('-')[0];
      
    const streamsList = streams
      .filter((s) => s.id.startsWith("remote-") && s.id.includes(publisherId));
  
    let videoOff = false;
    let micOff = false;
    let noCameraAvailable = false;
  
    if (streamsList.length > 0) {
      streamsList.forEach((stream) => {
        if (stream.metadata.type === "webcam") {
          videoOff = !stream.metadata.video;
        }
        if (stream.metadata.type === "mic") {
          micOff = !stream.metadata.audio;
        }
        if (stream.metadata.noCameraAvailable === true) {
          noCameraAvailable = true;
        }
      });
    }
  
    const streamObj = streams.find(s => s.id.includes(publisherId));
    const videoTracks = streamObj?.stream.getVideoTracks() || [];
    const videoEnabled = videoTracks.length > 0 && videoTracks[0].enabled;
    const hasNoVideoTracks = !streamObj || videoTracks.length === 0 || !videoEnabled;
    
    noCameraAvailable = noCameraAvailable || hasNoVideoTracks;

  
    return {
      videoOff: videoOff || noCameraAvailable,
      micOff,
      noCameraAvailable
    };
  };
  

  const isScreenShare = (streamId: string) => {
    return streamId.includes('screen') ||
      streamId.includes('screen');
  };

  const sortedStreams = activeStream
    ? [
      ...streams.filter(s => s.id === activeStream),
      ...streams.filter(s => s.id !== activeStream)
    ]
    : streams;

  const filteredStreams = useMemo(() => {
    const sortedByType = [...sortedStreams].sort((a, b) => {
      if (a.id === 'local') return -1;
      if (b.id === 'local') return 1;
      
      if (a.id.includes('-webcam-') && !b.id.includes('-webcam-')) return -1;
      if (!a.id.includes('-webcam-') && b.id.includes('-webcam-')) return 1;
      
      if (a.id.includes('-screen-') && !b.id.includes('-screen-')) return -1;
      if (!a.id.includes('-screen-') && b.id.includes('-screen-')) return 1;
      
      return 0;
    });
    
    const userStreams = new Map();
    
    sortedByType.forEach(stream => {
      if (stream.id === 'local') {
        userStreams.set('local', [...(userStreams.get('local') || []), stream]);
        return;
      }
      
      const parts = stream.id.split('-');
      if (parts.length >= 2) {
        const userName = parts[1];
        userStreams.set(userName, [...(userStreams.get(userName) || []), stream]);
      }
    });
    
    const result = [];
    
    userStreams.forEach((streams, userName) => {
      const hasVideoStream = streams.some(s => 
        s.id.includes('-webcam-') || 
        s.id.includes('-screen-') || 
        (s.id === 'local' && s.stream.getVideoTracks().length > 0)
      );
      
      if (hasVideoStream) {
        const videoStreams = streams.filter(s => 
          !s.id.includes('-mic-') || s.id === 'local'
        );
        result.push(...videoStreams);
      } else {
        const micStream = streams.find(s => s.id.includes('-mic-'));
        if (micStream) {
          result.push(micStream);
        } else {
          result.push(...streams);
        }
      }
    });
    
    return result;
  }, [sortedStreams]);

  const getGridColsClass = () => {
    const count = filteredStreams.filter(s => !s.id.includes('audio') && !s.id.includes('mic')).length;

    if (isMobile) return 'grid-cols-1';
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-3';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  return (
    <>
      <div className="hidden">
        {streams
          .filter(s => 
            s.id !== 'local' && 
            !s.id.includes('local-mic') &&
            !filteredStreams.some(f => f.id === s.id) && 
            (s.id.includes('-mic-') || s.id === 'audio')
          )
          .map(s => (
            <audio
              key={`audio-${s.id}`}
              ref={el => { if (el) el.srcObject = s.stream; }}
              autoPlay
            />
          ))}
      </div>
      
      <div className={`grid ${getGridColsClass()} gap-2 md:gap-4 h-[calc(100vh-120px)]`}>
        {filteredStreams.map((stream) => {
          const getUserName = (streamId: string) => {
            return streamId === 'local' ? 'Bạn' : streamId.split('-')[1];
          };
          const { videoOff, micOff } = getParticipantStatus(stream.id);
          
          const isScreen = isScreenShare(stream.id);
          const userName = getUserName(stream.id);
          const shouldShowNameBox = videoOff || 
                                   (stream.stream.getVideoTracks().length > 0 && !stream.stream.getVideoTracks()[0].enabled);
          return (
            <div
              key={stream.id}
              className={`relative bg-gray-800 rounded-lg overflow-hidden h-full w-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500 ${activeStream ? "aspect-video" : (streams.length === 1 ? "h-full" : "aspect-video")}`}
              onClick={() => setActiveStream(stream.id)}
            >
              <div
                className={`relative bg-gray-800 rounded-lg overflow-hidden w-full h-full ${speakingPeers.includes(stream.id.split('-')[1]) || isSpeaking ? "border-2 border-green-500" : ""}`}
              >
                <video
                  ref={el => videoRefs.current[stream.id] = el}
                  autoPlay
                  playsInline
                  muted={stream.id === 'local' || micOff}
                  className={`w-full h-full object-contain`}
                  style={{ display: shouldShowNameBox ? 'none' : 'block' }}
                />

                {shouldShowNameBox && !isScreen && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-blue-500 mx-auto flex items-center justify-center text-white text-2xl font-semibold mb-2">
                        {userName.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-white text-lg font-medium">{userName}</p>
                    </div>
                  </div>
                )}
              </div>

              <span className="absolute bottom-2 md:bottom-4 left-2 md:left-4 text-sm md:text-base text-white bg-black/60 px-2 py-1 rounded-md">
                {isScreen ? 'Màn hình chia sẻ' : userName}
              </span>

              <div className="absolute top-2 right-2 flex gap-2">
                {shouldShowNameBox && !isScreen && (
                  <div className="bg-black/60 p-1.5 rounded-full">
                    <VideoOff className="h-5 w-5 text-white" />
                  </div>
                )}
                {micOff && (
                  <div className="bg-black/60 p-1.5 rounded-full z-20">
                    <MicOff className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};