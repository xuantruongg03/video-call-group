import axiosClient from "@/apis/api-client";
import CONSTANT from "@/lib/constant";
import { useQuery } from "@tanstack/react-query";
import { Device, types as mediasoupTypes } from "mediasoup-client";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import hark from "hark";

const SFU_URL = import.meta.env.VITE_SFU_URL || "http://localhost:3002";
const SERVER_URL = import.meta.env.VITE_SERVER_URL;

// Cấu hình TURN server (nên có)
const iceServers = [
  { urls: "stun:freestun.net:3478" },
  { urls: "turn:freestun.net:3478", username: "free", credential: "free" },
];

interface StreamMetadata {
  video: boolean;
  audio: boolean;
  type?: string;
  isScreenShare?: boolean;
}

interface Stream {
  streamId: string;
  publisherId: string;
  metadata: StreamMetadata;
}

const fetchRoomInfo = async (roomId: string) => {
  const response = await axiosClient.post(
    `${SERVER_URL}/sfu/check-room-status`,
    { roomId }
  );
  return response.data;
};

// Khởi tạo socket và tự động kết nối
export const sfuSocket = io(SFU_URL, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

export function useCall(roomId: string, password?: string) {
  // States
  const [streams, setStreams] = useState<
    { id: string; stream: MediaStream; metadata?: StreamMetadata }[]
  >([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState<Set<string>>(new Set());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(sfuSocket.connected);
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomPassword, setRoomPassword] = useState<string | undefined>(
    password
  );
  const [transportReady, setTransportReady] = useState(false);

  // Refs
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

  // Thêm refs (không phải useState) để không phá vỡ thứ tự hooks
  const connectRetriesRef = useRef({ send: 0, recv: 0 });
  const transportConnectingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const connectingTransportsRef = useRef<Set<string>>(new Set());

  const setupDeviceAndTransports = useCallback(
    async (routerRtpCapabilities: mediasoupTypes.RtpCapabilities) => {
      try {
        // Create device if not already created
        if (!deviceRef.current) {
          deviceRef.current = new Device();
        }

        // Load router RTP capabilities
        if (!deviceRef.current.loaded) {
          await deviceRef.current.load({ routerRtpCapabilities });
        }

        // Send device's RTP capabilities to server
        sfuSocket.emit("sfu:set-rtp-capabilities", {
          rtpCapabilities: deviceRef.current.rtpCapabilities,
        });

        // Thêm vào trong transport creation
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

  // Publish local tracks
  const publishTracks = useCallback(async () => {
    if (
      !deviceRef.current?.loaded ||
      !sendTransportRef.current ||
      !localStreamRef.current
    ) {
      return false;
    }

    try {
      // Publish video track
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
          },
        });

        producersRef.current.set(videoProducer.id, {
          producer: videoProducer,
          kind: "video",
          appData: {
            video: true,
            audio: false,
            type: "webcam",
          },
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
          },
        });

        producersRef.current.set(audioProducer.id, {
          producer: audioProducer,
          kind: "audio",
          appData: {
            video: false,
            audio: true,
            type: "mic",
          },
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
    // Sử dụng transportReadyRef để kiểm tra xem transport đã từng kết nối thành công chưa
    // thay vì chỉ kiểm tra trạng thái hiện tại của transport
    if (!deviceRef.current?.loaded || !recvTransportRef.current) {
      console.log(
        `Transport chưa sẵn sàng, đưa stream ${streamInfo.streamId} vào hàng đợi`
      );

      // Chỉ đưa vào hàng đợi nếu chưa có stream này
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

  useEffect(() => {
    const processPendingStreams = () => {
      if (
        recvTransportRef.current &&
        recvTransportRef.current.connectionState === "connected" &&
        pendingStreamsRef.current.length > 0
      ) {
        const pendingStreams = [...pendingStreamsRef.current];
        pendingStreamsRef.current = [];

        // Thêm debug chi tiết
        pendingStreams.forEach((stream, index) => {
          setTimeout(() => {
            if (!recvTransportRef.current) {
              pendingStreamsRef.current.push(stream);
              return;
            }

            if (recvTransportRef.current.connectionState !== "connected") {
              console.error(
                `❌ Transport không ở trạng thái connected (${recvTransportRef.current.connectionState}) khi xử lý stream ${stream.streamId}`
              );
              pendingStreamsRef.current.push(stream);
              return;
            }

            console.log(
              `✅ Gửi yêu cầu consume cho stream ${stream.streamId}, transportId=${recvTransportRef.current.id}`
            );

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
              console.warn(
                `⚠️ Không nhận được phản hồi tạo consumer cho stream ${stream.streamId} sau 5 giây`
              );

              // Gửi lại yêu cầu
              if (
                recvTransportRef.current &&
                recvTransportRef.current.connectionState === "connected"
              ) {
                console.log(
                  `🔄 Thử lại yêu cầu consume cho stream ${stream.streamId}`
                );
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
          }, index * 300); // Tăng khoảng thời gian lên 300ms để tránh burst requests
        });
      } else {
        const reason = !recvTransportRef.current
          ? "Transport không tồn tại"
          : recvTransportRef.current.connectionState !== "connected"
          ? `Transport trạng thái: ${recvTransportRef.current.connectionState}`
          : `Không có streams trong hàng đợi (${pendingStreamsRef.current.length})`;

        console.log(`⚠️ Không thể xử lý streams đang chờ: ${reason}`);
      }
    };

    // Thêm sự kiện lắng nghe trạng thái kết nối
    if (recvTransportRef.current) {
      const handleConnectionChange = (state: string) => {
        console.log(`Receive transport state changed: ${state}`);
        if (state === "connected") {
          processPendingStreams();
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

      // Get username from localStorage
      const userName = localStorage.getItem(CONSTANT.USER_NAME);
      if (!userName) {
        setError("Username not found");
        toast.error("Username not found");
        return;
      }

      console.log(`Joining room ${roomId} as ${userName}`);

      // Join the room
      sfuSocket.emit("sfu:join", {
        roomId,
        peerId: userName,
        password: roomPassword,
      });

      hasJoinedRef.current = true;
    } catch (error: any) {
      console.error("Join room error:", error);
      setError(error.message || "Failed to join the room");
      toast.error(error.message || "Failed to join the room");
    }
  }, [roomId, roomPassword]);

  // Thiết lập password phòng
  useEffect(() => {
    if (password) {
      setRoomPassword(password);
    }
  }, [password]);

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

  // Set up socket listeners for SFU specific events
  useEffect(() => {
    if (!roomId) return;

    const onRouterCapabilities = async (data: {
      routerRtpCapabilities: mediasoupTypes.RtpCapabilities;
    }) => {
      console.log("Received router capabilities");
      await setupDeviceAndTransports(data.routerRtpCapabilities);
    };

    const onError = (err: { message: string; code: string }) => {
      console.error("SFU error:", err);
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
              setTransportReady(true);
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
              setTransportReady(true);
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

              setTransportReady(false);

              setTimeout(() => {
                if (deviceRef.current?.loaded) {
                  console.log(
                    "Trying to re-create receive transport after failure"
                  );
                  sfuSocket.emit("sfu:create-transport", {
                    roomId,
                    isProducer: false,
                    iceServers,
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
    }) => {
      try {
        if (!recvTransportRef.current) {
          throw new Error("Receive transport not initialized");
        }
        const existingConsumer = Array.from(consumersRef.current.values()).find(
          (c) => c.streamId === data.streamId && c.kind === data.kind
        );

        if (existingConsumer) {
          return;
        }

        const consumer = await recvTransportRef.current.consume({
          id: data.consumerId,
          producerId: data.producerId,
          kind: data.kind,
          rtpParameters: data.rtpParameters,
        });

        consumer.on("transportclose", () => {
          console.log(`Consumer transport closed for ${data.consumerId}`);
        });

        // sfuSocket.emit("sfu:request-keyframe", { streamId: data.streamId });
        // // Đảm bảo track được kích hoạt
        // if (consumer.track) {
        //   consumer.track.enabled = true;

        //   // Nếu là video track, thử tăng ưu tiên
        //   if (consumer.track.kind === "video") {
        //     try {
        //       consumer.track.contentHint = "motion";
        //       consumer.track.enabled = true;
        //     } catch (e) {
        //       console.log("Content hint not supported");
        //     }
        //   }
        // }

        consumersRef.current.set(data.consumerId, {
          consumer,
          streamId: data.streamId,
          kind: data.kind,
        });

        setTimeout(() => {
          sfuSocket.emit("sfu:resume-consumer", {
            consumerId: data.consumerId,
          });
        }, 50);
        if (!consumer.track) {
          return;
        }

        const remoteStreamId = makeRemoteId(data.streamId);
        let currentStream = remoteStreamsMapRef.current.get(remoteStreamId);

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

            if (streamIndex >= 0) {
              if (prev[streamIndex].stream !== currentStream) {
                const updated = [...prev];
                updated[streamIndex] = {
                  id: remoteStreamId,
                  stream: currentStream,
                  metadata: { video: true, audio: true },
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
                  metadata: { video: true, audio: true },
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
      const [publisherId, mediaType] = streamId.split("-"); 
      return `remote-${publisherId}-${mediaType}`; 
    }

    const onStreamAdded = (stream: Stream) => {
      const userName = localStorage.getItem(CONSTANT.USER_NAME);
      if (stream.publisherId !== userName) {
        consumeStream(stream);
      } else {
        console.log(`Ignoring my own stream ${stream.streamId}`);
      }
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

      setStreams((prev) => {
        return prev.filter((s) => s.id !== remoteStreamId);
      });
    };

    const onStreams = (availableStreams: Stream[]) => {
      // Nhóm streams theo publisherId
      const streamsByPublisher = new Map<string, Stream[]>();

      availableStreams.forEach((stream) => {
        // Bỏ qua stream của mình
        const userName = localStorage.getItem(CONSTANT.USER_NAME);
        if (stream.publisherId === userName) {
          return;
        }

        // Thêm vào nhóm theo publisherId
        if (!streamsByPublisher.has(stream.publisherId)) {
          streamsByPublisher.set(stream.publisherId, []);
        }
        streamsByPublisher.get(stream.publisherId)!.push(stream);
      });

      // Tiêu thụ từng stream
      streamsByPublisher.forEach((streams, publisherId) => {
        // Tiêu thụ mỗi stream từ publisher này
        streams.forEach((stream) => {
          consumeStream(stream);
        });
      });
    };

    const onPeerJoined = (data: { peerId: string }) => {
      console.log(`Peer joined: ${data.peerId}`);
      // You can update UI to show new participant
    };

    const onPeerLeft = (data: { peerId: string }) => {
      console.log(`Peer left: ${data.peerId}`);

      // Remove speaking status if applicable
      setSpeakingPeers((prev) => {
        const newSpeakingPeers = new Set(prev);
        newSpeakingPeers.delete(data.peerId);
        return newSpeakingPeers;
      });

      // Xóa stream từ remoteStreamsMap
      const remoteStreamId = `remote-${data.peerId}`;
      remoteStreamsMapRef.current.delete(data.peerId);

      // Cập nhật UI bằng cách xóa stream của người dùng khỏi mảng streams
      setStreams((prev) =>
        prev.filter((stream) => stream.id !== remoteStreamId)
      );

      console.log(`Stream removed: ${data.peerId}`);
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
      setIsLocked(data.locked);
      if (data.locked) {
        toast.info(`Room locked by ${data.lockedBy}`);
      } else {
        toast.info(`Room unlocked by ${data.unlockedBy}`);
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
        setTransportReady(true);

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
    sfuSocket.on("sfu:peer-joined", onPeerJoined);
    sfuSocket.on("sfu:peer-left", onPeerLeft);
    sfuSocket.on("sfu:user-speaking", onUserSpeaking);
    sfuSocket.on("sfu:user-stopped-speaking", onUserStoppedSpeaking);
    sfuSocket.on("sfu:room-locked", onRoomLocked);
    sfuSocket.on("sfu:transport-connected", onTransportConnected);

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
      sfuSocket.off("sfu:peer-joined", onPeerJoined);
      sfuSocket.off("sfu:peer-left", onPeerLeft);
      sfuSocket.off("sfu:user-speaking", onUserSpeaking);
      sfuSocket.off("sfu:user-stopped-speaking", onUserStoppedSpeaking);
      sfuSocket.off("sfu:room-locked", onRoomLocked);
      sfuSocket.off("sfu:transport-connected", onTransportConnected);
    };
  }, [roomId, setupDeviceAndTransports, streams, consumeStream, publishTracks]);

  // Thêm useEffect để tự động khởi tạo local media khi đã tham gia room thành công
  useEffect(() => {
    if (isJoined) {
      // Đợi một khoảng thời gian nhỏ để đảm bảo transport đã được thiết lập
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

  // Giữ nguyên các function khác như initializeLocalMedia, toggleVideo, toggleAudio...

  // Function để cung cấp mật khẩu phòng
  const provideRoomPassword = useCallback(
    (password: string) => {
      setRoomPassword(password);
      hasJoinedRef.current = false; // Reset để thử lại

      // Tham gia lại phòng với mật khẩu mới
      if (sfuSocket.connected) {
        joinRoom();
      }
    },
    [joinRoom]
  );

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;

        producersRef.current.forEach((info, streamId) => {
          if (info.kind === "video") {
            sfuSocket.emit("sfu:update", {
              streamId,
              metadata: {
                video: videoTrack.enabled,
              },
            });
          }
        });

        return videoTrack.enabled;
      }
    }
    return false;
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;

        // Update metadata on server
        producersRef.current.forEach((info, streamId) => {
          if (info.kind === "audio") {
            sfuSocket.emit("sfu:update", {
              streamId,
              metadata: {
                audio: audioTrack.enabled,
              },
            });
          }
        });

        return audioTrack.enabled;
      }
    }
    return false;
  }, []);

  // Initialize local media
  const initializeLocalMedia = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      // Ensure all tracks are enabled
      stream.getTracks().forEach((track) => {
        track.enabled = true;
      });

      localStreamRef.current = stream;

      // QUAN TRỌNG: Đảm bảo thêm stream vào STATE
      setStreams((prev) => {
        // Xóa stream 'local' cũ nếu có
        const filteredStreams = prev.filter((s) => s.id !== "local");
        // Thêm stream mới vào đầu danh sách với metadata
        return [
          {
            id: "local",
            stream,
            metadata: { video: true, audio: true },
          },
          ...filteredStreams,
        ];
      });

      // Setup speech detection
      if (speechEventsRef.current) {
        speechEventsRef.current.stop();
      }

      speechEventsRef.current = hark(stream, {
        threshold: -65,
        interval: 100,
      });

      speechEventsRef.current.on("speaking", () => {
        setIsSpeaking(true);
        const userName = localStorage.getItem(CONSTANT.USER_NAME);
        if (userName && isJoined) {
          sfuSocket.emit("sfu:my-speaking", {
            roomId,
            peerId: userName,
          });
        }
      });

      speechEventsRef.current.on("stopped_speaking", () => {
        setIsSpeaking(false);
        const userName = localStorage.getItem(CONSTANT.USER_NAME);
        if (userName && isJoined) {
          sfuSocket.emit("sfu:stop-speaking", {
            roomId,
            peerId: userName,
          });
        }
      });

      // Nếu transport đã sẵn sàng, publish ngay
      if (sendTransportRef.current && deviceRef.current?.loaded) {
        await publishTracks();
      }

      return true;
    } catch (error) {
      console.error("Error getting media:", error);
      toast.error("Failed to access camera or microphone");
      return false;
    }
  }, [roomId, isJoined, publishTracks]);

  // Toggle room lock
  const toggleLockRoom = useCallback(
    (password?: string) => {
      if (isLocked) {
        sfuSocket.emit("sfu:unlock-room", { roomId });
      } else if (password) {
        const userName = localStorage.getItem(CONSTANT.USER_NAME);
        sfuSocket.emit("sfu:lock-room", {
          roomId,
          password,
          creatorId: userName,
        });
      }
    },
    [roomId, isLocked]
  );

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    try {
      console.log("isScreenSharing", isScreenSharing);
      console.log("screenStreamRef.current", screenStreamRef.current);
      // If already sharing screen, stop
      if (isScreenSharing && screenStreamRef.current) {
        console.log("Stopping screen share");

        // Stop all tracks in screen share
        screenStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });

        // Find and unpublish screen producers
        producersRef.current.forEach((info) => {
          if (info?.streamId?.includes("screen")) {
            sfuSocket.emit("sfu:unpublish", { streamId: info.streamId });
          }
        });

        // Only remove screen sharing streams from the UI
        setStreams((prev) =>
          prev.filter((stream) => stream.id !== "screen-local")
        );

        screenStreamRef.current = null;
        setIsScreenSharing(false);
        return false;
      }

      // Start screen sharing
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
        } as MediaTrackConstraints,
        audio: false,
      });

      screenStreamRef.current = screenStream;

      // Add screen stream to display list
      setStreams((prev) => [
        ...prev,
        { id: "screen-local", stream: screenStream },
      ]);

      // Publish screen stream
      if (sendTransportRef.current) {
        const videoTrack = screenStream.getVideoTracks()[0];

        // Publish screen video
        const producer = await sendTransportRef.current.produce({
          track: videoTrack,
          appData: {
            video: true,
            audio: false,
            type: "screen",
            isScreenShare: true,
          },
        });

        // Update state
        setIsScreenSharing(true);

        // Handle when user stops screen sharing from browser
        videoTrack.onended = () => {
          console.log("Screen sharing ended by user");

          // Find and unpublish screen producer
          producersRef.current.forEach((info, streamId) => {
            if (info.appData && info.appData.type === "screen") {
              sfuSocket.emit("sfu:unpublish", { streamId });
              producersRef.current.delete(streamId);
            }
          });

          screenStream.getTracks().forEach((track) => track.stop());
          screenStreamRef.current = null;
          setIsScreenSharing(false);

          // Remove screen sharing stream from UI
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

  return {
    // Connection state
    isConnected,
    isJoined,
    error,

    // Media streams
    streams,

    // Control functions
    provideRoomPassword,
    initializeLocalMedia,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    toggleLockRoom,
    // leaveRoom,

    // Screen sharing state
    isScreenSharing,

    // Room state
    isLocked,

    // Speaking state
    speakingPeers,
    isSpeaking,
  };
}
