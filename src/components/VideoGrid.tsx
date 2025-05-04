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
  
    // Handle screen sharing streams
    if (participantId === 'screen-local' || isScreenShare(participantId)) {
      // Kiểm tra xem screen share stream có audio track hay không
      const screenStream = participantId === 'screen-local' 
        ? streams.find(s => s.id === 'screen-local')
        : streams.find(s => s.id === participantId);
        
      const hasAudioTracks = screenStream?.stream.getAudioTracks().length > 0;
      
      return {
        videoOff: false,
        micOff: !hasAudioTracks, // Chỉ đánh dấu muted nếu không có audio track
        noCameraAvailable: false
      };
    }
    
    const publisherId = participantId.startsWith('remote-') 
      ? participantId.split('-')[1] 
      : participantId.split('-')[0];
      
    const streamsList = streams
      .filter((s) => s.id.startsWith("remote-") && s.id.includes(publisherId) && !isScreenShare(s.id));
  
    let videoOff = false;
    let micOff = false;
    let noCameraAvailable = false;
  
    if (streamsList.length > 0) {
      streamsList.forEach((stream) => {
        if (stream.metadata?.type === "webcam") {
          videoOff = !stream.metadata.video;
        }
        if (stream.metadata?.type === "mic") {
          micOff = !stream.metadata.audio;
        }
        if (stream.metadata?.noCameraAvailable === true) {
          noCameraAvailable = true;
        }
      });
    }
    console.log(streams);
  
    const streamObj = streams.find(s => 
      s.id.includes(publisherId) && 
      !isScreenShare(s.id)
    );
    
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
           (streamId.includes('type=screen')) ||
           streamId === 'screen-local';
  };

  const sortedStreams = activeStream
    ? [
      ...streams.filter(s => s.id === activeStream),
      ...streams.filter(s => s.id !== activeStream)
    ]
    : streams;

  const filteredStreams = useMemo(() => {
    const sortedByType = [...sortedStreams].sort((a, b) => {
      // Screen shares get top priority
      if (isScreenShare(a.id) && !isScreenShare(b.id)) return -1;
      if (!isScreenShare(a.id) && isScreenShare(b.id)) return 1;
      
      // Then local stream
      if (a.id === 'local') return -1;
      if (b.id === 'local') return 1;
      
      // Then webcams
      if (a.id.includes('-webcam-') && !b.id.includes('-webcam-')) return -1;
      if (!a.id.includes('-webcam-') && b.id.includes('-webcam-')) return 1;
      
      return 0;
    });
    
    // Create a map to group streams by user
    const userStreams = new Map();
    
    sortedByType.forEach(stream => {
      if (stream.id === 'local') {
        userStreams.set('local', [...(userStreams.get('local') || []), stream]);
        return;
      }
      
      if (stream.id === 'screen-local') {
        userStreams.set('screen-local', [...(userStreams.get('screen-local') || []), stream]);
        return;
      }
      
      const parts = stream.id.split('-');
      if (parts.length >= 2) {
        const userName = parts[1];
        userStreams.set(userName, [...(userStreams.get(userName) || []), stream]);
      }
    });
    
    const result = [];
    
    sortedByType.forEach(stream => {
      if (isScreenShare(stream.id) && 
        !(stream.metadata?.type === "screen-audio" || stream.id.includes("-screen-audio-"))) {
        result.push(stream);
      }
    });
    
    userStreams.forEach((streams, userName) => {
      const nonScreenStreams = streams.filter(s => !isScreenShare(s.id));
      if (nonScreenStreams.length === 0) return;
      const hasVideoStream = nonScreenStreams.some(s => 
        s.id.includes('-webcam-') || 
        (s.id === 'local' && s.stream.getVideoTracks().length > 0) ||
        s.metadata?.type === 'webcam'
      );
      
      if (hasVideoStream) {
        const videoStreams = nonScreenStreams.filter(s => 
          !s.id.includes('-mic-') || s.id === 'local'
        );
        
        videoStreams.forEach(stream => {
          if (!result.some(s => s.id === stream.id)) {
            result.push(stream);
          }
        });
      } else {
        const micStream = nonScreenStreams.find(s => 
          s.id.includes('-mic-') || s.metadata?.type === 'mic'
        );
        
        if (micStream && !result.some(s => s.id === micStream.id)) {
          result.push(micStream);
        } else if (nonScreenStreams.length > 0 && !result.some(s => s.id === nonScreenStreams[0].id)) {
          result.push(nonScreenStreams[0]);
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
            (s.id.includes('-mic-') || s.id === 'audio') &&
            !isScreenShare(s.id)
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
            if (streamId === 'local') return 'Bạn';
            if (streamId === 'screen-local') return 'Bạn (Màn hình)';
            
            const parts = streamId.split('-');
            return parts.length > 1 ? parts[1] : streamId;
          };
          
          const { videoOff, micOff } = getParticipantStatus(stream.id);
          
          const isScreen = isScreenShare(stream.id);
          const userName = getUserName(stream.id);
          const hasAudio = stream.stream.getAudioTracks().length > 0;
          
          const isScreenWithAudio = isScreen && hasAudio;
          
          let audioStream = null;
          if (isScreen && !hasAudio) {
            const screenShareId = stream.id.includes("screen-local") ? "screen-local" : stream.id;
            const baseId = screenShareId.split('-')[0] + '-' + screenShareId.split('-')[1];
            
            audioStream = streams.find(s => 
              s.id.includes(baseId) && 
              s.id.includes("screen-audio") &&
              s.stream.getAudioTracks().length > 0
            );
          }
          
          const shouldShowNameBox = videoOff || 
                                   (stream.stream.getVideoTracks().length > 0 && 
                                    !stream.stream.getVideoTracks()[0].enabled);
          
          return (
            <div
              key={stream.id}
              className={`relative bg-gray-800 rounded-lg overflow-hidden h-full w-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500 ${activeStream ? "aspect-video" : (streams.length === 1 ? "h-full" : "aspect-video")}`}
              onClick={() => setActiveStream(stream.id)}
            >
              <div
                className={`relative bg-gray-800 rounded-lg overflow-hidden w-full h-full ${
                  speakingPeers.includes(stream.id.split('-')[1]) || 
                  (stream.id === 'local' && isSpeaking) || 
                  (hasAudio && !micOff) ? "border-2 border-green-500" : ""}`}
              >
                <video
                  ref={el => videoRefs.current[stream.id] = el}
                  autoPlay
                  playsInline
                  muted={stream.id === 'local' || (micOff && !isScreenWithAudio)}
                  className={`w-full h-full object-contain`}
                  style={{ display: shouldShowNameBox ? 'none' : 'block' }}
                />

                {audioStream && (
                  <audio 
                    className="hidden"
                    ref={el => { if (el) el.srcObject = audioStream.stream; }}
                    autoPlay
                  />
                )}

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
                {isScreen ? (stream.id === 'screen-local' ? 'Màn hình của bạn' : 'Màn hình chia sẻ') : userName}
                {(isScreenWithAudio || audioStream) && <span className="ml-1">🔊</span>}
              </span>

              <div className="absolute top-2 right-2 flex gap-2">
                {shouldShowNameBox && !isScreen && (
                  <div className="bg-black/60 p-1.5 rounded-full">
                    <VideoOff className="h-5 w-5 text-white" />
                  </div>
                )}
                {micOff && !isScreenWithAudio && !audioStream && (
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