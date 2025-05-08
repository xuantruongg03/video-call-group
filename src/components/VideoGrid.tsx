import { useIsMobile } from "@/hooks/use-mobile";
import { AnimatePresence, motion } from "framer-motion";
import { Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StreamTile } from "./StreamTile";
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

  const getGridLayout = () => {
    const count = filteredStreams.filter(s => !s.id.includes('audio') && !s.id.includes('mic')).length;
    const totalCount = count > visibleStreamsCount ? visibleStreamsCount + 1 : count;

    if (isMobile) {
      if (totalCount === 1) {
        return {
          gridClass: 'grid-cols-1',
          containerClass: 'flex items-center justify-center h-[calc(100vh-100px)]'
        };
      }
      if (totalCount === 2) {
        return {
          gridClass: 'grid-cols-2',
          containerClass: 'max-h-[85vh]'
        };
      }
      return {
        gridClass: 'grid-cols-2 grid-rows-2',
        containerClass: 'h-auto'
      };
    }
    
    if (totalCount === 1) {
      return {
        gridClass: 'grid-cols-1',
        containerClass: 'flex items-center justify-center h-[calc(100vh-100px)] max-w-[70vw] mx-auto'
      };
    }
    if (totalCount === 2) {
      return {
        gridClass: 'grid-cols-2 ',
        containerClass: 'h-[calc(100vh-120px)] w-full'
      };
    }
    if (totalCount <= 4) {
      return {
        gridClass: 'grid-cols-2 grid-rows-2',
        containerClass: 'h-auto max-w-5xl mx-auto'
      };
    }
    return {
      gridClass: 'grid-cols-3 grid-rows-3',
      containerClass: 'h-auto max-w-7xl mx-auto'
    };
  };

  // Calculate how many streams to show and how many to hide
  const visibleStreamsCount = isMobile ? 3 : 8;
  const streamsToShow = filteredStreams.slice(0, visibleStreamsCount);
  const remainingStreams = filteredStreams.length > visibleStreamsCount ? 
    filteredStreams.slice(visibleStreamsCount) : [];
  
  const { gridClass, containerClass } = getGridLayout();
  const isSingle = streamsToShow.length === 1 && remainingStreams.length === 0;

  const RemainingTile = () => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="relative bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center aspect-video w-full h-full"
    >
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-blue-500 mx-auto flex items-center justify-center text-white mb-2">
          <Users className="h-10 w-10" />
        </div>
        <p className="text-white text-lg font-medium">+{remainingStreams.length} người khác</p>
      </div>
    </motion.div>
  );

  return (
    <div id="video-grid" className="video-grid">
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

      {isSingle ? (
        <div className="flex items-center justify-center h-[calc(100vh-150px)] mt-7 w-full px-1 participant-container">
          <div className="h-[calc(100vh-120px)] w-full">
            <StreamTile
              stream={streamsToShow[0]}
              userName={(() => {
                const streamId = streamsToShow[0].id;
                if (streamId === 'local') return 'Bạn';
                if (streamId === 'screen-local') return 'Bạn (Màn hình)';
                const parts = streamId.split('-');
                return parts.length > 1 ? parts[1] : streamId;
              })()}
              isSpeaking={isSpeaking || speakingPeers.includes(streamsToShow[0].id)}
              isActive={activeStream === streamsToShow[0].id}
              onClick={() => setActiveStream(streamsToShow[0].id)}
              videoOff={getParticipantStatus(streamsToShow[0].id).videoOff}
              micOff={getParticipantStatus(streamsToShow[0].id).micOff}
              isScreen={isScreenShare(streamsToShow[0].id)}
              audioStream={null}
            />
          </div>
        </div>
      ) : (
        <div className={`${containerClass} min-h-0 flex-grow px-2`}>
          <div className={`grid ${gridClass} gap-1 md:gap-2`}>
            <AnimatePresence>
              {streamsToShow.map((stream) => {
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
                return (
                  <div key={stream.id} className="aspect-video participant-container">
                    <StreamTile
                      stream={stream}
                      userName={userName}
                      isSpeaking={isSpeaking || speakingPeers.includes(stream.id)}
                      isActive={activeStream === stream.id}
                      onClick={() => setActiveStream(stream.id)}
                      videoOff={videoOff}
                      micOff={micOff}
                      isScreen={isScreen}
                      audioStream={audioStream}
                    />
                  </div>
                );
              })}
              {remainingStreams.length > 0 && (
                <div className="aspect-video participant-container">
                  <RemainingTile />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};