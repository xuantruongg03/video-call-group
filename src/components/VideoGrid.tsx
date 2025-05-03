import { sfuSocket } from "@/hooks/use-call";
import { MicOff, Speaker, VideoOff, Volume2 } from "lucide-react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface StreamMetadata {
  [streamId: string]: {
    publisherId: string;
    metadata: {
      video: boolean;
      audio: boolean;
      type?: string;
      noCameraAvailable?: boolean;
    }
  }
}

export const VideoGrid = ({ streams, isVideoOff, isMuted, speakingPeers, isSpeaking }: { 
  streams: { id: string; stream: MediaStream; metadata?: any }[], 
  isVideoOff: boolean, 
  isMuted: boolean, 
  speakingPeers: string[], 
  isSpeaking: boolean 
}) => {
  // const [streamMetadata, setStreamMetadata] = useState<StreamMetadata>({});
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

  const isAudioOnly = useCallback((streamId: string) => {
    const stream = streams.find(s => s.id === streamId);
    if (!stream) return false;
    
    // Check stream metadata
    const hasCameraFlag = stream.metadata?.noCameraAvailable === true;
    
    // Check if it's a mic stream by ID pattern
    const isMicStream = streamId.includes('-mic-');
    
    // Check track types and status
    const videoTracks = stream.stream.getVideoTracks();
    const hasVideoTracks = videoTracks.length > 0;
    const isVideoEnabled = hasVideoTracks && videoTracks[0].enabled;
    const hasOnlyAudioTracks = stream.stream.getAudioTracks().length > 0 && 
                              (!hasVideoTracks || !isVideoEnabled);
    
    return hasCameraFlag || isMicStream || hasOnlyAudioTracks;
  }, [streams]);

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
        videoOff: isVideoOff, // Video off state based on the prop
        micOff: isMuted, // Mic off state based on the prop
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
  
    // Ensure that video off state isn't wrongly triggered when mic is turned off
    const streamObj = streams.find(s => s.id.includes(publisherId));
    const videoTracks = streamObj?.stream.getVideoTracks() || [];
    const videoEnabled = videoTracks.length > 0 && videoTracks[0].enabled;
    const hasNoVideoTracks = !streamObj || videoTracks.length === 0 || !videoEnabled;
    console.log("hasNoVideoTracks", hasNoVideoTracks);
    console.log("noCameraAvailable", noCameraAvailable);
    
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

  // Filter streams to avoid duplicate displays (prefer webcam over mic streams)
  const filteredStreams = useMemo(() => {
    // First, sort streams by type (webcam > screen > mic)
    const sortedByType = [...sortedStreams].sort((a, b) => {
      // Prefer local stream
      if (a.id === 'local') return -1;
      if (b.id === 'local') return 1;
      
      // Prefer webcam streams
      if (a.id.includes('-webcam-') && !b.id.includes('-webcam-')) return -1;
      if (!a.id.includes('-webcam-') && b.id.includes('-webcam-')) return 1;
      
      // Prefer screen streams
      if (a.id.includes('-screen-') && !b.id.includes('-screen-')) return -1;
      if (!a.id.includes('-screen-') && b.id.includes('-screen-')) return 1;
      
      return 0;
    });
    
    // Then, filter out mic streams if the user has a webcam or screen stream
    const userStreams = new Map();
    
    // First pass: collect all user's streams by username
    sortedByType.forEach(stream => {
      if (stream.id === 'local') {
        userStreams.set('local', [...(userStreams.get('local') || []), stream]);
        return;
      }
      
      // Extract username from IDs like remote-Username-mic-timestamp or remote-Username-webcam-timestamp
      const parts = stream.id.split('-');
      if (parts.length >= 2) {
        const userName = parts[1];
        userStreams.set(userName, [...(userStreams.get(userName) || []), stream]);
      }
    });
    
    // Second pass: for each user, if they have multiple streams, include only webcam/screen streams
    // unless they only have mic streams
    const result = [];
    
    userStreams.forEach((streams, userName) => {
      // Check if user has webcam or screen streams
      const hasVideoStream = streams.some(s => 
        s.id.includes('-webcam-') || 
        s.id.includes('-screen-') || 
        (s.id === 'local' && s.stream.getVideoTracks().length > 0)
      );
      
      if (hasVideoStream) {
        // If they have video streams, include only those and filter out mic streams
        const videoStreams = streams.filter(s => 
          !s.id.includes('-mic-') || s.id === 'local'
        );
        result.push(...videoStreams);
      } else {
        // If they only have mic streams, keep one of them (first one)
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
          // Regular handling for other streams...
          const getUserName = (streamId: string) => {
            return streamId === 'local' ? 'Bạn' : streamId.split('-')[1];
          };
          const { videoOff, micOff, noCameraAvailable } = getParticipantStatus(stream.id);
          console.log(`Stream ${stream.id} have videoOff: ${videoOff}, micOff: ${micOff}, noCameraAvailable: ${noCameraAvailable}`);
          
          const isScreen = isScreenShare(stream.id);
          const userName = getUserName(stream.id);
          
          // Check if stream has audio tracks but no video tracks
          // const hasAudioOnlyTracks = stream.stream.getAudioTracks().length > 0 && 
          //                          stream.stream.getVideoTracks().length === 0;
          
          // Call the isAudioOnly function defined earlier
          // const streamIsAudioOnly = isAudioOnly(stream.id);
          
          // Enhanced audio-only detection for more reliability
          // const shouldShowAvatar = hasAudioOnlyTracks || 
          //                   noCameraAvailable || 
          //                   // streamIsAudioOnly ||
          //                   stream.metadata?.noCameraAvailable === true ||
          //                   stream.metadata?.video === false ||
          //                   stream.metadata?.type === 'mic';
          
          // // Simplified condition - if ANY of these are true, show the avatar box
          const shouldShowNameBox = videoOff || 
                                  //  shouldShowAvatar ||
                                  //  stream.id.includes('-mic-') ||
                                   (stream.stream.getVideoTracks().length > 0 && !stream.stream.getVideoTracks()[0].enabled);
          return (
            <div
              key={stream.id}
              className={`relative bg-gray-800 rounded-lg overflow-hidden h-full w-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500 ${activeStream ? "aspect-video" : (streams.length === 1 ? "h-full" : "aspect-video")}`}
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
                  <div className="bg-black/60 p-1.5 rounded-full">
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