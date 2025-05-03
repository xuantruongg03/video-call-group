import CONSTANT from "@/lib/constant";
import hark from "hark";
import { Device, types as mediasoupTypes } from "mediasoup-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { useNetworkMonitor } from './use-network-monitor';
const SFU_URL = import.meta.env.VITE_SFU_URL || "http://localhost:3002";

interface StreamMetadata {
  video: boolean;
  audio: boolean;
  type?: string;
  isScreenShare?: boolean;
  noCameraAvailable?: boolean;
  noMicroAvailable?: boolean;
}

interface Stream {
  streamId: string;
  publisherId: string;
  metadata: StreamMetadata;
}

export const sfuSocket = io(SFU_URL, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  autoConnect: false,
});
export function useCall(roomId: string, password?: string) {
  const [streams, setStreams] = useState<
    { id: string; stream: MediaStream; metadata?: StreamMetadata }[]
  >([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState<Set<string>>(new Set());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(sfuSocket.connected);
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // const [roomPassword, setRoomPassword] = useState<string | undefined>(
  //   password
  // );
  const room = useSelector((state: any) => state.room);
  const deviceRef = useRef<Device | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const sendTransportRef = useRef<mediasoupTypes.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupTypes.Transport | null>(null);
  const producersRef = useRef<Map<string, any>>(new Map());
  const consumersRef = useRef<Map<string, any>>(new Map());
  const speechEventsRef = useRef<any>(null);
  const hasJoinedRef = useRef(false);
  const remoteStreamsMapRef = useRef(new Map<string, MediaStream>());
  const pendingStreamsRef = useRef<Stream[]>([]);
  const transportReadyRef = useRef<boolean>(false);
  const publishedKindsRef = useRef<{ video?: boolean; audio?: boolean }>({});
  const producerIdToRemoteId = useRef<Map<string, string>>(new Map());

  const connectRetriesRef = useRef({ send: 0, recv: 0 });
  const transportConnectingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const connectingTransportsRef = useRef<Set<string>>(new Set());
  const dispatch = useDispatch();
  
  const { startMonitoring, stopMonitoring } = useNetworkMonitor({
    transport: recvTransportRef.current,
    onPoorNetworkDetected: () => {
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack && videoTrack.enabled) {
          toast.info("Mạng yếu, tắt camera");
          toggleVideo();
        }
      }
    },
    onGoodNetworkDetected: () => {
      
    }
  });

  const setupDeviceAndTransports = useCallback(
    async (routerRtpCapabilities: mediasoupTypes.RtpCapabilities) => {
      try {
        if (!deviceRef.current) {
          deviceRef.current = new Device();
        }

        if (!deviceRef.current.loaded) {
          await deviceRef.current.load({ routerRtpCapabilities });
        }

        sfuSocket.emit("sfu:set-rtp-capabilities", {
          rtpCapabilities: deviceRef.current.rtpCapabilities,
        });

        sfuSocket.emit("sfu:create-transport", {
          roomId,
          isProducer: true,
        });

        sfuSocket.emit("sfu:create-transport", {
          roomId,
          isProducer: false,
        });
      } catch (error) {
        console.error("Error setting up device:", error);
        toast.error("Failed to initialize media connections");
      }
    },
    [roomId]
  );

  const publishTracks = useCallback(async () => {
    if (
      !deviceRef.current?.loaded ||
      !sendTransportRef.current ||
      !localStreamRef.current
    ) {
      return false;
    }

    try {
      const cameraAvailable =
        localStreamRef.current.getVideoTracks().length > 0;
      // Kiểm tra xem microphone có khả dụng không
      // const microAvailable = localStreamRef.current.getAudioTracks().length > 0;

      // Publish video track nếu có
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack && !publishedKindsRef.current.video) {
        const videoProducer = await sendTransportRef.current.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100000 },
            { maxBitrate: 300000 },
            { maxBitrate: 900000 },
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
          appData: {
            video: true,
            audio: false,
            type: "webcam",
            noCameraAvailable: false,
            // noMicroAvailable: !microAvailable,
          },
        });

        producersRef.current.set(videoProducer.id, {
          producer: videoProducer,
          kind: "video",
          streamId: videoProducer.id,
          // appData: {
          //   video: true,
          //   audio: false,
          //   type: "webcam",
          //   noCameraAvailable: false,
          //   // noMicroAvailable: !microAvailable,
          // },
        });
        publishedKindsRef.current.video = true;
      }

      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const audioProducer = await sendTransportRef.current.produce({
          track: audioTrack,
          codecOptions: {
            opusStereo: true,
            opusDtx: true,
          },
          appData: {
            video: false,
            audio: true,
            type: "mic",
            noCameraAvailable: !cameraAvailable,
            noMicroAvailable: false,
          },
        });

        producersRef.current.set(audioProducer.id, {
          producer: audioProducer,
          kind: "audio",
          // appData: {
          //   video: false,
          //   audio: true,
          //   type: "mic",
          //   noCameraAvailable: !cameraAvailable,
          //   noMicroAvailable: false,
          // },
        });
        publishedKindsRef.current.audio = true;
      }

      return true;
    } catch (error) {
      console.error("Error publishing tracks:", error);
      toast.error("Failed to publish your video and audio");
      return false;
    }
  }, []);

  // Consumer stream
  const consumeStream = useCallback(async (streamInfo: Stream) => {
    if (!deviceRef.current?.loaded || !recvTransportRef.current) {
      const exists = pendingStreamsRef.current.some(
        (s) => s.streamId === streamInfo.streamId
      );
      if (!exists) {
        pendingStreamsRef.current.push(streamInfo);
      }
      return;
    }

    try {
      sfuSocket.emit("sfu:consume", {
        streamId: streamInfo.streamId,
        transportId: recvTransportRef.current.id,
      });
    } catch (error) {
      console.error("Lỗi khi consume stream:", error);
    }
  }, []);

  // Thêm sự kiện lắng nghe trạng thái kết nối
  useEffect(() => {
    const processPendingStreams = () => {
      if (
        recvTransportRef.current &&
        recvTransportRef.current.connectionState === "connected" &&
        pendingStreamsRef.current.length > 0
      ) {
        const pendingStreams = [...pendingStreamsRef.current];
        pendingStreamsRef.current = [];

        pendingStreams.forEach((stream, index) => {
          setTimeout(() => {
            if (!recvTransportRef.current) {
              pendingStreamsRef.current.push(stream);
              return;
            }

            if (recvTransportRef.current.connectionState !== "connected") {
              pendingStreamsRef.current.push(stream);
              return;
            }

            // Gửi yêu cầu với thêm tham số để debug
            sfuSocket.emit("sfu:consume", {
              streamId: stream.streamId,
              transportId: recvTransportRef.current.id,
              debugInfo: {
                transportState: recvTransportRef.current.connectionState,
                connectionTime: new Date().toISOString(),
              },
            });

            // Thêm timeout để kiểm tra xem consumer có được tạo hay không
            const timeoutId = setTimeout(() => {
              // Gửi lại yêu cầu
              if (
                recvTransportRef.current &&
                recvTransportRef.current.connectionState === "connected"
              ) {
                sfuSocket.emit("sfu:consume", {
                  streamId: stream.streamId,
                  transportId: recvTransportRef.current.id,
                  retry: true,
                });
              }
            }, 5000);

            // Lưu timeout ID để có thể hủy nếu consumer được tạo thành công
            const streamKey = `${stream.streamId}_timeout`;
            connectRetriesRef.current.recv = 0;
            connectRetriesRef.current.recv++;
            connectRetriesRef.current[streamKey] = timeoutId;
          }, index * 300);
        });
      } else {
        const reason = !recvTransportRef.current
          ? "Transport không tồn tại"
          : recvTransportRef.current.connectionState !== "connected"
          ? `Transport trạng thái: ${recvTransportRef.current.connectionState}`
          : `Không có streams trong hàng đợi (${pendingStreamsRef.current.length})`;

        console.log(`Không thể xử lý streams đang chờ: ${reason}`);
      }
    };

    // Thêm sự kiện lắng nghe trạng thái kết nối
    if (recvTransportRef.current) {
      const handleConnectionChange = (state: string) => {
        if (state === "connected") {
          processPendingStreams();
          //Kiểm tra nếu có camera thì bắt đầu monitoring
          if (localStreamRef.current?.getVideoTracks().length > 0) {
            startMonitoring();
          }
        }
      };

      recvTransportRef.current.on(
        "connectionstatechange",
        handleConnectionChange
      );

      return () => {
        if (recvTransportRef.current) {
          recvTransportRef.current.off(
            "connectionstatechange",
            handleConnectionChange
          );
        }
      };
    }
  }, [recvTransportRef.current]);

  // Hàm tham gia phòng
  const joinRoom = useCallback(() => {
    try {
      // Chỉ tham gia nếu đã kết nối và chưa tham gia
      if (!sfuSocket.connected || hasJoinedRef.current) {
        return;
      }

      setError(null);
      const userName = room.username;
      if (!userName) {
        setError("Username not found");
        toast.error("Username not found");
        return;
      }

      sfuSocket.emit("sfu:join", {
        roomId,
        peerId: userName,
        password: room.password,
      });

      hasJoinedRef.current = true;
    } catch (error: any) {
      console.error("Join room error:", error);
      setError(error.message || "Lỗi khi tham gia phòng");
      toast.error(error.message || "Lỗi khi tham gia phòng");
    }
  }, [roomId]);

  // Thiết lập password phòng
  // useEffect(() => {
  //   if (room.password) {
  //     setRoomPassword(room.password);
  //   }
  // }, [room.password]);

  // Xử lý kết nối socket và tham gia phòng
  useEffect(() => {
    const onConnectSuccess = () => {
      console.log("Socket connected to SFU server");
      setIsConnected(true);
      joinRoom();
    };

    const onDisconnect = () => {
      console.log("Socket disconnected from SFU server");
      setIsConnected(false);
      setIsJoined(false);
      hasJoinedRef.current = false;
    };

    const onConnectError = (err: Error) => {
      console.error("Socket connection error:", err);
      setError("Failed to connect to SFU server");
    };

    sfuSocket.on("connect", onConnectSuccess);
    sfuSocket.on("disconnect", onDisconnect);
    sfuSocket.on("connect_error", onConnectError);

    if (sfuSocket.connected) {
      joinRoom();
    }

    return () => {
      sfuSocket.off("connect", onConnectSuccess);
      sfuSocket.off("disconnect", onDisconnect);
      sfuSocket.off("connect_error", onConnectError);
    };
  }, [joinRoom]);

  // Xử lý sự kiện
  useEffect(() => {
    if (!roomId) return;

    const onRouterCapabilities = async (data: {
      routerRtpCapabilities: mediasoupTypes.RtpCapabilities;
    }) => {
      console.log("Received router capabilities");
      await setupDeviceAndTransports(data.routerRtpCapabilities);
    };

    const onError = (err: { message: string; code: string; streamId?: string }) => {
      setError(err.message);
      toast.error(err.message);

      if (err.code === "ROOM_PASSWORD_REQUIRED") {
        hasJoinedRef.current = false;
      }
    };

    const onRtpCapabilitiesSet = () => {
      console.log("RTP capabilities set");
      setIsJoined(true);
    };

    const onTransportCreated = async (transportInfo: any) => {
      try {
        if (!deviceRef.current) {
          throw new Error("Device not initialized");
        }

        const transport = transportInfo.isProducer
          ? deviceRef.current.createSendTransport(transportInfo)
          : deviceRef.current.createRecvTransport(transportInfo);

        if (!transportInfo.isProducer) {
          recvTransportRef.current = transport;
          pendingStreamsRef.current.forEach((s) => {
            sfuSocket.emit("sfu:consume", {
              streamId: s.streamId,
              transportId: transport.id,
            });
          });
          pendingStreamsRef.current = [];
        }

        if (transportInfo.isProducer) {
          sendTransportRef.current = transport;

          // Set up send transport event handlers
          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            // Kiểm tra và đảm bảo có fingerprint
            if (
              !dtlsParameters.fingerprints ||
              dtlsParameters.fingerprints.length === 0
            ) {
              console.error("Missing fingerprints in DTLS parameters!");
            }
            dtlsParameters.role = "client";
            sfuSocket.emit("sfu:connect-transport", {
              transportId: transport.id,
              dtlsParameters,
            });

            sfuSocket.once("sfu:transport-connected", () => {
              transportReadyRef.current = true;
              callback();
            });

            sfuSocket.once("sfu:error", (error) => {
              errback(error);
            });
          });

          transport.on("produce", async (parameters, callback, errback) => {
            try {
              sfuSocket.emit("sfu:produce", {
                transportId: transport.id,
                kind: parameters.kind,
                rtpParameters: parameters.rtpParameters,
                metadata: parameters.appData,
              });

              sfuSocket.once("sfu:producer-created", (data) => {
                producersRef.current.set(data.producerId, {
                  producerId: data.producerId,
                  streamId: data.streamId,
                  kind: data.kind,
                  appData: data.appData,
                });
                callback({ id: data.producerId });
              });

              sfuSocket.once("sfu:error", (error) => {
                errback(error);
              });
            } catch (error) {
              errback(error);
            }
          });
        } else {
          recvTransportRef.current = transport;
          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            try {
              if (connectingTransportsRef.current.has(transport.id)) {
                callback();
                return;
              }
              connectingTransportsRef.current.add(transport.id);
              dtlsParameters.role = "client";
              sfuSocket.emit("sfu:connect-transport", {
                transportId: transport.id,
                dtlsParameters,
              });

              const handleTransportConnected = (data: {
                transportId: string;
              }) => {
                if (data.transportId === transport.id) {
                  sfuSocket.off(
                    "sfu:transport-connected",
                    handleTransportConnected
                  );
                  sfuSocket.off("sfu:error", handleError);
                  clearTimeout(timeoutId);
                  callback();
                }
              };

              const handleError = (error: any) => {
                sfuSocket.off(
                  "sfu:transport-connected",
                  handleTransportConnected
                );
                sfuSocket.off("sfu:error", handleError);
                clearTimeout(timeoutId);

                connectingTransportsRef.current.delete(transport.id);

                errback(error);
              };

              sfuSocket.on("sfu:transport-connected", handleTransportConnected);
              sfuSocket.on("sfu:error", handleError);

              const timeoutId = setTimeout(() => {
                sfuSocket.off(
                  "sfu:transport-connected",
                  handleTransportConnected
                );
                sfuSocket.off("sfu:error", handleError);

                connectingTransportsRef.current.delete(transport.id);

                errback(new Error("Transport connection timeout"));
              }, 30000);
            } catch (error) {
              connectingTransportsRef.current.delete(transport.id);
              errback(error);
            }
          });

          transport.on("connectionstatechange", (state) => {
            console.log(`Receive transport state changed: ${state}`);

            if (state === "connected") {
              transportReadyRef.current = true;
              sfuSocket.emit("sfu:get-streams", { roomId });
              if (pendingStreamsRef.current.length > 0) {
                const pendingStreams = [...pendingStreamsRef.current];
                pendingStreamsRef.current = [];

                pendingStreams.forEach((stream) => {
                  consumeStream(stream);
                });
              }
            } else if (
              state === "failed" ||
              state === "disconnected" ||
              state === "closed"
            ) {
              toast.error(
                "Kết nối nhận video bị gián đoạn. Đang thử kết nối lại..."
              );

              transportReadyRef.current = false;

              setTimeout(() => {
                if (deviceRef.current?.loaded) {
                  console.log(
                    "Trying to re-create receive transport after failure"
                  );
                  sfuSocket.emit("sfu:create-transport", {
                    roomId,
                    isProducer: false,
                  });
                }
              }, 2000);
            } else if (
              state === "connecting" &&
              !transportConnectingTimerRef.current
            ) {
              transportConnectingTimerRef.current = setTimeout(() => {
                if (
                  recvTransportRef.current &&
                  recvTransportRef.current.connectionState === "connecting"
                ) {
                  if (pendingStreamsRef.current.length > 0) {
                    const firstStream = pendingStreamsRef.current[0];
                    sfuSocket.emit("sfu:consume", {
                      streamId: firstStream.streamId,
                      transportId: recvTransportRef.current.id,
                      forceConnect: true,
                    });
                  } else {
                    sfuSocket.emit("sfu:get-streams", { roomId });
                  }
                }

                transportConnectingTimerRef.current = null;
              }, 5000);
            }
          });
        }
        if (!transportInfo.isProducer) {
          recvTransportRef.current = transport;
        }
      } catch (error) {
        console.error("Error creating transport:", error);
      }
    };

    const onConsumerCreated = async (data: {
      consumerId: string;
      streamId: string;
      producerId: string;
      kind: mediasoupTypes.MediaKind;
      rtpParameters: mediasoupTypes.RtpParameters;
      metadata?: any;
    }) => {
      try {
        if (!recvTransportRef.current) {
          console.error("Receive transport not created yet");
          return;
        }

        // Add the consumer
        const consumer = await recvTransportRef.current.consume({
          id: data.consumerId,
          producerId: data.producerId,
          kind: data.kind,
          rtpParameters: data.rtpParameters,
        });

        consumersRef.current.set(data.consumerId, {
          consumer,
          streamId: data.streamId,
          metadata: data.metadata,
        });

        // Resume the consumer immediately
        sfuSocket.emit("sfu:resume-consumer", {
          consumerId: data.consumerId,
        });

        // Make sure we're creating a consistent remoteId
        const remoteStreamId = makeRemoteId(data.streamId);
        let currentStream = remoteStreamsMapRef.current.get(remoteStreamId);
        producerIdToRemoteId.current.set(data.producerId, remoteStreamId);

        if (currentStream) {
          try {
            currentStream.addTrack(consumer.track);
          } catch (e) {
            currentStream = new MediaStream([consumer.track]);
            remoteStreamsMapRef.current.set(remoteStreamId, currentStream);
          }
        } else {
          currentStream = new MediaStream([consumer.track]);
          remoteStreamsMapRef.current.set(remoteStreamId, currentStream);
        }

        setTimeout(() => {
          setStreams((prev) => {
            const streamIndex = prev.findIndex((s) => s.id === remoteStreamId);

            // Extract publisherId and mediaType from streamId
            const parts = data.streamId.split("-");
            const publisherId = parts[0];
            const mediaType = parts.slice(1).join("-");

            // Find if we already have metadata for this stream
            const streamsFromServer = pendingStreamsRef.current.find(
              (s) => s.streamId === data.streamId
            );

            // Determine stream type attributes
            const isAudioStream =
              data.kind === "audio" || mediaType.includes("mic");
            const isVideoStream =
              data.kind === "video" || mediaType.includes("webcam");

            // Detect audio-only scenario: if this is an audio stream and we don't have video streams
            // from the same publisher
            const publisherVideoStreams = prev.filter(
              (s) =>
                s.id.includes(publisherId) &&
                s.stream.getVideoTracks().length > 0 &&
                !s.id.includes("screen")
            );

            const isAudioOnly =
              isAudioStream && publisherVideoStreams.length === 0;

            // Prepare metadata with appropriate flags
            const metadata = {
              video: isVideoStream,
              audio: isAudioStream,
              type: isAudioStream
                ? "mic"
                : isVideoStream
                ? "webcam"
                : undefined,
              noCameraAvailable:
                data.metadata?.noCameraAvailable === true ||
                streamsFromServer?.metadata?.noCameraAvailable === true ||
                (isAudioOnly && mediaType.includes("mic")),
            };

            if (streamIndex >= 0) {
              if (prev[streamIndex].stream !== currentStream) {
                const updated = [...prev];
                updated[streamIndex] = {
                  id: remoteStreamId,
                  stream: currentStream,
                  metadata: metadata,
                };
                return updated;
              }
              return prev;
            } else {
              return [
                ...prev,
                {
                  id: remoteStreamId,
                  stream: currentStream,
                  metadata: metadata,
                },
              ];
            }
          });
        }, 100);
      } catch (error) {
        console.error("Error creating consumer:", error);
      }
    };

    const onConsumerResumed = (data: { consumerId: string }) => {
      console.log(`Consumer ${data.consumerId} resumed`);
    };

    const onConsumerClosed = (data: {
      consumerId: string;
      streamId: string;
    }) => {
      consumersRef.current.delete(data.consumerId);

      setStreams((prev) => {
        const streamIndex = prev.findIndex((s) => s.id === data.streamId);
        if (streamIndex >= 0) {
          return [
            ...prev.slice(0, streamIndex),
            ...prev.slice(streamIndex + 1),
          ];
        }
        return prev;
      });
    };

    function makeRemoteId(streamId: string) {
      if (!streamId.includes("-")) {
        return `remote-${streamId}-unknown`;
      }

      const parts = streamId.split("-");
      const publisherId = parts[0];
      const mediaType = parts.slice(1).join("-");
      const result = `remote-${publisherId}-${mediaType}`;
      return result;
    }

    const onStreamAdded = (stream: Stream) => {
      const metadata = {
        ...stream.metadata,
        video: stream.metadata?.video ?? false,
        audio: stream.metadata?.audio ?? true,
        type: stream.metadata?.type || "mic",
        noCameraAvailable: stream.metadata?.noCameraAvailable === true,
      };

      // Update the metadata in pendingStreams
      pendingStreamsRef.current = pendingStreamsRef.current.map((s) => {
        if (s.streamId === stream.streamId) {
          return {
            ...s,
            metadata: metadata,
          };
        }
        return s;
      });

      // Consume the stream
      consumeStream({
        ...stream,
        metadata: metadata,
      });
    };

    const onStreamRemoved = (data: {
      streamId: string;
      publisherId: string;
    }) => {
      const remoteStreamId = makeRemoteId(data.streamId);

      const consumersToDelete: string[] = [];
      consumersRef.current.forEach((info, consumerId) => {
        if (info.streamId === data.streamId) {
          consumersToDelete.push(consumerId);
        }
      });

      consumersToDelete.forEach((id) => consumersRef.current.delete(id));

      setStreams((prev) => prev.filter((s) => s.id !== remoteStreamId));
    };

    const onStreams = (availableStreams: Stream[]) => {
      availableStreams.forEach((stream) => {
        const updatedStream = {
          ...stream,
          metadata: {
            ...stream.metadata,
            noCameraAvailable:
              stream.metadata.noCameraAvailable ||
              (stream.metadata.type === "mic" &&
                stream.metadata.noCameraAvailable === true),
          },
        };
        consumeStream(updatedStream);
      });
    };

    const onPeerLeft = (data: { peerId: string }) => {
      setSpeakingPeers((prev) => {
        const newSpeakingPeers = new Set(prev);
        newSpeakingPeers.delete(data.peerId);
        return newSpeakingPeers;
      });
      remoteStreamsMapRef.current.forEach((stream, id) => {
        if (id.includes(data.peerId)) {
          remoteStreamsMapRef.current.delete(id);
        }
      });

      setStreams((prev) =>
        prev.filter((stream) => !stream.id.includes(data.peerId))
      );
    };

    const onUserSpeaking = (data: { peerId: string }) => {
      setSpeakingPeers((prev) => {
        const newSpeakingPeers = new Set(prev);
        newSpeakingPeers.add(data.peerId);
        return newSpeakingPeers;
      });
    };

    const onUserStoppedSpeaking = (data: { peerId: string }) => {
      setSpeakingPeers((prev) => {
        const newSpeakingPeers = new Set(prev);
        newSpeakingPeers.delete(data.peerId);
        return newSpeakingPeers;
      });
    };

    const onRoomLocked = (data: {
      locked: boolean;
      lockedBy?: string;
      unlockedBy?: string;
    }) => {
      dispatch({ type: "JOIN_ROOM", payload: { isLocked: data.locked } });
      if (data.locked) {
        toast.info(`Phòng đã bị khóa bởi ${data.lockedBy}`);
      } else {
        toast.info(`Phòng đã được mở khóa bởi ${data.unlockedBy}`);
      }
    };

    // Thêm listener cho sfu:transport-connected
    const onTransportConnected = (data: { transportId: string }) => {
      // Check cho send transport
      if (
        sendTransportRef.current &&
        sendTransportRef.current.id === data.transportId
      ) {
        // Kiểm tra nếu có local stream nhưng không có producer nào
        if (localStreamRef.current && producersRef.current.size === 0) {
          console.log(
            "Phát hiện local stream tồn tại nhưng không có producer, bắt đầu publish"
          );

          // Republish các tracks
          const tracks = [];
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          const audioTrack = localStreamRef.current.getAudioTracks()[0];

          if (videoTrack) {
            tracks.push({
              kind: "video",
              track: videoTrack,
              enabled: videoTrack.enabled,
            });
          }

          if (audioTrack) {
            tracks.push({
              kind: "audio",
              track: audioTrack,
              enabled: audioTrack.enabled,
            });
          }
        }
      }

      // Check cho receive transport
      if (
        recvTransportRef.current &&
        recvTransportRef.current.id === data.transportId
      ) {
        console.log(`✅ Receive transport đã kết nối: ${data.transportId}`);

        // Forcefully update the state and process pending streams immediately
        transportReadyRef.current = true;

        // Handle any streams waiting in the queue
        if (pendingStreamsRef.current.length > 0) {
          console.log(
            `Processing ${pendingStreamsRef.current.length} queued streams`
          );

          const pendingStreams = [...pendingStreamsRef.current];
          pendingStreamsRef.current = [];

          // Process each stream with a small delay between them
          pendingStreams.forEach((stream, index) => {
            setTimeout(() => {
              if (
                recvTransportRef.current &&
                recvTransportRef.current.connectionState === "connected"
              ) {
                sfuSocket.emit("sfu:consume", {
                  streamId: stream.streamId,
                  transportId: recvTransportRef.current.id,
                });
              }
            }, index * 100);
          });
        }
      }
    };

    // Thêm handler cho sự kiện stream-updated
    const onStreamUpdated = (data: {
      streamId: string;
      publisherId: string;
      metadata: any;
    }) => {
      setStreams((prev) => {
        return prev.map((stream) => {
          if (stream.id.includes(data.publisherId + "-" + data.metadata.type)) {
            const updatedMetadata = { ...stream.metadata };
            if (data.metadata.type === "mic") {
              updatedMetadata.audio = data.metadata.audio;
            } else if (data.metadata.type === "webcam") {
              updatedMetadata.video = data.metadata.video;
            }

            if (data.metadata.noCameraAvailable !== undefined) {
              updatedMetadata.noCameraAvailable =
                data.metadata.noCameraAvailable;
            }

            return {
              ...stream,
              metadata: updatedMetadata,
            };
          }
          return stream;
        });
      });
    };

    // Thêm handler cho sự kiện presence
    const onPresence = (data: {
      peerId: string;
      metadata: StreamMetadata;
    }) => {
      console.log(`Received presence from ${data.peerId} with metadata:`, data.metadata);
      
      // Tạo một ID độc nhất cho người dùng này
      const remoteId = `remote-${data.peerId}-presence`;
      
      // Kiểm tra xem người dùng đã có stream khác (không phải presence) chưa
      const hasRegularStream = streams.some(stream => 
        stream.id.includes(data.peerId) && 
        !stream.id.includes('presence')
      );
      
      // Nếu đã có stream thông thường, không cần hiển thị presence
      if (hasRegularStream) {
        console.log(`User ${data.peerId} already has a regular stream, ignoring presence`);
        return;
      }
      
      // Kiểm tra nếu đã có stream presence cho người dùng này
      const existingPresence = streams.find(s => s.id === remoteId);
      if (existingPresence) {
        // Nếu đã có rồi thì không cần thêm vào nữa để tránh render lại
        console.log(`User ${data.peerId} already has a presence stream, not updating UI`);
        return;
      }
      
      // Tạo một MediaStream trống để hiển thị
      const emptyStream = new MediaStream();
      
      // Thêm vào danh sách streams để hiển thị UI (chỉ khi chưa có)
      setStreams((prev) => {
        // Kiểm tra lần nữa để tránh race condition
        const existingStreamIndex = prev.findIndex(s => s.id === remoteId);
        
        if (existingStreamIndex >= 0) {
          return prev; // Người dùng đã tồn tại, không cần thêm
        }
        
        // Kiểm tra và xóa bất kỳ stream presence cũ nào của cùng người dùng
        const filteredStreams = prev.filter(s => 
          !(s.id.includes(data.peerId) && s.id.includes('presence') && s.id !== remoteId)
        );
        
        console.log(`Adding presence UI for ${data.peerId}`);
        return [
          ...filteredStreams,
          {
            id: remoteId,
            stream: emptyStream,
            metadata: {
              ...data.metadata,
              video: false,
              audio: false,
              noCameraAvailable: true,
              noMicroAvailable: true,
            },
          },
        ];
      });
    };

    sfuSocket.on("sfu:error", onError);
    sfuSocket.on("sfu:router-capabilities", onRouterCapabilities);
    sfuSocket.on("sfu:rtp-capabilities-set", onRtpCapabilitiesSet);
    sfuSocket.on("sfu:transport-created", onTransportCreated);
    sfuSocket.on("sfu:consumer-created", onConsumerCreated);
    sfuSocket.on("sfu:consumer-resumed", onConsumerResumed);
    sfuSocket.on("sfu:consumer-closed", onConsumerClosed);
    sfuSocket.on("sfu:stream-added", onStreamAdded);
    sfuSocket.on("sfu:stream-removed", onStreamRemoved);
    sfuSocket.on("sfu:streams", onStreams);
    sfuSocket.on("sfu:peer-left", onPeerLeft);
    sfuSocket.on("sfu:user-removed", onPeerLeft);
    sfuSocket.on("sfu:user-speaking", onUserSpeaking);
    sfuSocket.on("sfu:user-stopped-speaking", onUserStoppedSpeaking);
    sfuSocket.on("sfu:room-locked", onRoomLocked);
    sfuSocket.on("sfu:transport-connected", onTransportConnected);
    sfuSocket.on("sfu:stream-updated", onStreamUpdated);
    sfuSocket.on("sfu:presence", onPresence); 

    // Cleanup
    return () => {
      sfuSocket.off("sfu:error", onError);
      sfuSocket.off("sfu:router-capabilities", onRouterCapabilities);
      sfuSocket.off("sfu:rtp-capabilities-set", onRtpCapabilitiesSet);
      sfuSocket.off("sfu:transport-created", onTransportCreated);
      sfuSocket.off("sfu:consumer-created", onConsumerCreated);
      sfuSocket.off("sfu:consumer-resumed", onConsumerResumed);
      sfuSocket.off("sfu:consumer-closed", onConsumerClosed);
      sfuSocket.off("sfu:stream-added", onStreamAdded);
      sfuSocket.off("sfu:stream-removed", onStreamRemoved);
      sfuSocket.off("sfu:streams", onStreams);
      sfuSocket.off("sfu:peer-left", onPeerLeft);
      sfuSocket.off("sfu:user-removed", onPeerLeft);
      sfuSocket.off("sfu:user-speaking", onUserSpeaking);
      sfuSocket.off("sfu:user-stopped-speaking", onUserStoppedSpeaking);
      sfuSocket.off("sfu:room-locked", onRoomLocked);
      sfuSocket.off("sfu:transport-connected", onTransportConnected);
      sfuSocket.off("sfu:stream-updated", onStreamUpdated);
      sfuSocket.off("sfu:presence", onPresence); 
    };
  }, [roomId, setupDeviceAndTransports, streams, consumeStream, publishTracks]);

  // Thêm useEffect để tự động khởi tạo local media khi đã tham gia room thành công
  useEffect(() => {
    if (isJoined) {
      const timer = setTimeout(() => {
        console.log("Initializing local media after join...");
        initializeLocalMedia().then((success) => {
          if (success) {
            console.log("Local media initialized successfully");
          } else {
            console.error("Failed to initialize local media");
          }
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isJoined]);

  // Function để cung cấp mật khẩu phòng
  // const provideRoomPassword = useCallback(
  //   (password: string) => {
  //     // setRoomPassword(password);
  //     hasJoinedRef.current = false;
  //     if (sfuSocket.connected) {
  //       joinRoom();
  //     }
  //   },
  //   [joinRoom]
  // );

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;

        const currentStream = streams.find((s) => s.id === "local");
        const currentAudioState = currentStream?.metadata?.audio;
        const noMicroState = currentStream?.metadata?.noMicroAvailable || false;

        producersRef.current.forEach((info, producerId) => {
          if (info.kind === "video") {
            const streamId = info.streamId || producerId;

            sfuSocket.emit("sfu:update", {
              streamId: streamId,
              metadata: {
                video: videoTrack.enabled,
                type: "webcam",
                noCameraAvailable: !videoTrack.enabled,
                noMicroAvailable: noMicroState,
              },
            });
          }
        });

        setStreams((prev) => {
          return prev.map((stream) => {
            if (stream.id === "local") {
              const updatedMetadata = {
                ...stream.metadata,
                video: videoTrack.enabled,
                noCameraAvailable: !videoTrack.enabled,
                noMicroAvailable: noMicroState,
                type: "webcam",
                audio: currentAudioState,
              };
              return {
                ...stream,
                metadata: updatedMetadata,
              };
            }
            return stream;
          });
        });

        return videoTrack.enabled;
      }
    }
    return false;
  }, [streams]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const videoTracks = localStreamRef.current.getVideoTracks();
        const videoTrack = videoTracks.length > 0 ? videoTracks[0] : null;
        const videoEnabled = videoTrack ? videoTrack.enabled : false;

        const currentStream = streams.find((s) => s.id === "local");
        const videoState = currentStream?.metadata?.video || false;
        const noCameraState =
          currentStream?.metadata?.noCameraAvailable ||
          !videoEnabled ||
          videoTracks.length === 0;
        const noMicroState = currentStream?.metadata?.noMicroAvailable || false;

        // Cập nhật cho tất cả producers audio
        producersRef.current.forEach((info, producerId) => {
          if (info.kind === "audio") {
            sfuSocket.emit("sfu:update", {
              streamId: info.streamId || producerId,
              metadata: {
                audio: audioTrack.enabled,
                noMicroAvailable: noMicroState,
              },
            });
          }
        });

        setStreams((prev) => {
          return prev.map((stream) => {
            if (stream.id === "local") {
              const updatedMetadata = {
                ...stream.metadata,
                audio: audioTrack.enabled,
                video: videoState,
                noCameraAvailable: noCameraState,
                noMicroAvailable: noMicroState,
              };

              return {
                ...stream,
                metadata: updatedMetadata,
              };
            }
            return stream;
          });
        });

        return audioTrack.enabled;
      }
    }
    return false;
  }, [streams]);

  // khởi tạo media
  const initializeLocalMedia = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      try {
        // Thử với cả video và audio
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        stream.getTracks().forEach((track) => {
          track.enabled = true;
        });

        localStreamRef.current = stream;
        setStreams((prev) => {
          const filteredStreams = prev.filter((s) => s.id !== "local");
          return [
            {
              id: "local",
              stream,
              metadata: {
                video: true,
                audio: true,
                noCameraAvailable: false,
                noMicroAvailable: false,
              },
            },
            ...filteredStreams,
          ];
        });

        if (speechEventsRef.current) {
          speechEventsRef.current.stop();
        }

        speechEventsRef.current = hark(stream, {
          threshold: -65,
          interval: 100,
        });

        speechEventsRef.current.on("speaking", () => {
          setIsSpeaking(true);
          const userName = room.username;
          if (userName && isJoined) {
            sfuSocket.emit("sfu:my-speaking", {
              roomId,
              peerId: userName,
            });
          }
        });

        speechEventsRef.current.on("stopped_speaking", () => {
          setIsSpeaking(false);
          const userName = room.username;
          if (userName && isJoined) {
            sfuSocket.emit("sfu:stop-speaking", {
              roomId,
              peerId: userName,
            });
          }
        });

        if (sendTransportRef.current && deviceRef.current?.loaded) {
          await publishTracks();
        }

        return true;
      } catch (errorAudioVideo) {
        console.error("Error getting camera and mic:", errorAudioVideo);

        try {
          // Nếu không thể lấy video, thử với audio
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });

          localStreamRef.current = audioOnlyStream;
          setStreams((prev) => {
            const filteredStreams = prev.filter((s) => s.id !== "local");
            return [
              {
                id: "local",
                stream: audioOnlyStream,
                metadata: {
                  video: false,
                  audio: true,
                  noCameraAvailable: true,
                  noMicroAvailable: false,
                },
              },
              ...filteredStreams,
            ];
          });

          // Cấu hình phát hiện giọng nói
          if (speechEventsRef.current) {
            speechEventsRef.current.stop();
          }

          speechEventsRef.current = hark(audioOnlyStream, {
            threshold: -65,
            interval: 100,
          });

          speechEventsRef.current.on("speaking", () => {
            setIsSpeaking(true);
            const userName = room.username;
            if (userName && isJoined) {
              sfuSocket.emit("sfu:my-speaking", {
                roomId,
                peerId: userName,
              });
            }
          });

          speechEventsRef.current.on("stopped_speaking", () => {
            setIsSpeaking(false);
            const userName = room.username;
            if (userName && isJoined) {
              sfuSocket.emit("sfu:stop-speaking", {
                roomId,
                peerId: userName,
              });
            }
          });

          // Phát audio-only track với flag noCameraAvailable
          if (isJoined) {
            publishAudioOnly();
          }

          return true;
        } catch (errorAudio) {
          console.error("Error getting microphone:", errorAudio);

          try {
            // thử với video
            const videoOnlyStream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            });

            localStreamRef.current = videoOnlyStream;
            setStreams((prev) => {
              const filteredStreams = prev.filter((s) => s.id !== "local");
              return [
                {
                  id: "local",
                  stream: videoOnlyStream,
                  metadata: {
                    video: true,
                    audio: false,
                    noCameraAvailable: false,
                    noMicroAvailable: true,
                  },
                },
                ...filteredStreams,
              ];
            });

            // phát video-only track với metadata
            if (
              isJoined &&
              sendTransportRef.current &&
              deviceRef.current?.loaded
            ) {
              publishVideoOnly();
            }

            toast.error(
              "Không thể truy cập microphone, bạn sẽ không thể nói chuyện"
            );
            return true;
          } catch (errorVideo) {
            console.error(
              "Error getting both camera and microphone:",
              errorVideo
            );

            // tạo stream rỗng
            const emptyStream = new MediaStream();
            localStreamRef.current = emptyStream;

            setStreams((prev) => {
              const filteredStreams = prev.filter((s) => s.id !== "local");
              return [
                {
                  id: "local",
                  stream: emptyStream,
                  metadata: {
                    video: false,
                    audio: false,
                    noCameraAvailable: true,
                    noMicroAvailable: true,
                  },
                },
                ...filteredStreams,
              ];
            });

            // phát media rỗng
            if (isJoined) {
              publicMediaEmpty();
            }
            toast.error("Không thể truy cập cả camera và microphone");
            return false;
          }
        }
      }
    } catch (error) {
      console.error("Error initializing local media:", error);
      toast.error("Failed to initialize your camera and microphone");
      return false;
    }
  }, [isJoined, publishTracks, room.username, roomId]);

  // Thêm hàm mới để publish chỉ audio khi không có camera
  const publishAudioOnly = useCallback(async () => {
    if (
      !deviceRef.current?.loaded ||
      !sendTransportRef.current ||
      !localStreamRef.current
    ) {
      return false;
    }

    try {
      console.log("Publishing audio only tracks...");

      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack && !publishedKindsRef.current.audio) {
        const audioProducer = await sendTransportRef.current.produce({
          track: audioTrack,
          codecOptions: {
            opusStereo: true,
            opusDtx: true,
          },
          appData: {
            video: false,
            audio: true,
            type: "mic",
            noCameraAvailable: true,
          },
        });

        producersRef.current.set(audioProducer.id, {
          producer: audioProducer,
          kind: "audio",
          appData: {
            video: false,
            audio: true,
            type: "mic",
            noCameraAvailable: true,
          },
        });
        publishedKindsRef.current.audio = true;
      }

      return true;
    } catch (error) {
      console.error("Error publishing audio track:", error);
      toast.error("Failed to publish your audio");
      return false;
    }
  }, []);

  const publicMediaEmpty = useCallback(async () => {
    if (localStreamRef.current) {
      const hasVideo = localStreamRef.current.getVideoTracks().length > 0;
      const hasAudio = localStreamRef.current.getAudioTracks().length > 0;
      
      if (!hasVideo && !hasAudio) {
        // Delay việc gửi presence để đảm bảo join đã hoàn thành
        setTimeout(() => {
          if (sfuSocket.connected) {
            console.log("Sending initial presence notification after join");
            sfuSocket.emit("sfu:presence", {
              roomId,
              peerId: room.username,
              metadata: {
                video: false,
                audio: false,
                type: "presence",
                noCameraAvailable: true,
                noMicroAvailable: true,
              }
            });
            
          }
        }, 1500); // tăng độ trễ lên 1.5 giây để đảm bảo join đã hoàn thành
      }
    }
    return false;
  }, [roomId, room.username]);

  // thêm hàm để phát video khi microphone thất bại
  const publishVideoOnly = useCallback(async () => {
    if (
      !deviceRef.current?.loaded ||
      !sendTransportRef.current ||
      !localStreamRef.current
    ) {
      return false;
    }

    try {
      console.log("Publishing video only tracks...");

      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack && !publishedKindsRef.current.video) {
        const videoProducer = await sendTransportRef.current.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100000 },
            { maxBitrate: 300000 },
            { maxBitrate: 900000 },
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
          appData: {
            video: true,
            audio: false,
            type: "webcam",
            noCameraAvailable: false,
          },
        });

        producersRef.current.set(videoProducer.id, {
          producer: videoProducer,
          kind: "video",
          streamId: videoProducer.id,
          appData: {
            video: true,
            audio: false,
            type: "webcam",
            noCameraAvailable: false,
          },
        });
        publishedKindsRef.current.video = true;
      }

      return true;
    } catch (error) {
      console.error("Error publishing video track:", error);
      toast.error("Failed to publish your video");
      return false;
    }
  }, []);

  const toggleLockRoom = useCallback(
    (password?: string) => {
      if (room.isLocked) {
        sfuSocket.emit("sfu:unlock-room", { roomId });
      } else if (password) {
        // const userName = localStorage.getItem(CONSTANT.USER_NAME);
        const userName = room.username;
        sfuSocket.emit("sfu:lock-room", {
          roomId,
          password,
          creatorId: userName,
        });
      }
    },
    [roomId, room.isLocked]
  );

  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing && screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });

        producersRef.current.forEach((info) => {
          if (info?.streamId?.includes("screen")) {
            sfuSocket.emit("sfu:unpublish", { streamId: info.streamId });
          }
        });
        setStreams((prev) =>
          prev.filter((stream) => stream.id !== "screen-local")
        );

        screenStreamRef.current = null;
        setIsScreenSharing(false);
        return false;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
        } as MediaTrackConstraints,
        audio: false,
      });

      screenStreamRef.current = screenStream;
      setStreams((prev) => [
        ...prev,
        { id: "screen-local", stream: screenStream },
      ]);

      if (sendTransportRef.current) {
        const videoTrack = screenStream.getVideoTracks()[0];

        await sendTransportRef.current.produce({
          track: videoTrack,
          appData: {
            video: true,
            audio: false,
            type: "screen",
            isScreenShare: true,
          },
        });

        setIsScreenSharing(true);
        videoTrack.onended = () => {
          producersRef.current.forEach((info, streamId) => {
            if (info.appData && info.appData.type === "screen") {
              sfuSocket.emit("sfu:unpublish", { streamId });
              producersRef.current.delete(streamId);
            }
          });

          screenStream.getTracks().forEach((track) => track.stop());
          screenStreamRef.current = null;
          setIsScreenSharing(false);

          setStreams((prev) =>
            prev.filter((stream) => stream.id !== "screen-local")
          );
        };
      }

      return true;
    } catch (error) {
      console.error("Error sharing screen:", error);
      return false;
    }
  }, [isScreenSharing]);

  const clearConnection = useCallback(() => {
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    producersRef.current.forEach(({ producer }) => producer.close());
    consumersRef.current.forEach(({ consumer }) => consumer.close());
    deviceRef.current = null;
    localStreamRef.current = null;
    screenStreamRef.current = null;
    sendTransportRef.current = null;
    recvTransportRef.current = null;
    producersRef.current.clear();
    consumersRef.current.clear();
    speechEventsRef.current = null;
    hasJoinedRef.current = false;
    remoteStreamsMapRef.current.clear();
    pendingStreamsRef.current = [];
    transportReadyRef.current = false;
    publishedKindsRef.current = {};
    connectRetriesRef.current = { send: 0, recv: 0 };
    transportConnectingTimerRef.current = null;
    connectingTransportsRef.current.clear();
    sfuSocket.emit("sfu:leave-room", { roomId });
    // sfuSocket.removeAllListeners();
    sfuSocket.disconnect();
    sfuSocket.close();
    sfuSocket.io.opts.autoConnect = false;
    sfuSocket.io.opts.reconnection = false;
    setIsJoined(false);
    setIsConnected(false);
    dispatch({ type: "LEAVE_ROOM" });
    setStreams([]);
    setIsScreenSharing(false);
    setIsSpeaking(false);
    // setRoomPassword("");
    stopMonitoring();
  }, []);

  return {
    isConnected,
    isJoined,
    error,
    streams,
    // provideRoomPassword,
    initializeLocalMedia,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    toggleLockRoom,
    clearConnection,
    isScreenSharing,
    speakingPeers,
    isSpeaking,
  };
}
