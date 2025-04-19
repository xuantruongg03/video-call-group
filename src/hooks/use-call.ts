import CONSTANT from '@/lib/constant';
import Peer from 'peerjs';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';

const SFU_URL = import.meta.env.VITE_SFU_URL;

export const sfuSocket = io(SFU_URL, { 
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

export function useCall(roomId: string) {
  const [streams, setStreams] = useState<{ id: string; stream: MediaStream }[]>([]);
  const peer = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const publishedStreams = useRef<Map<string, any>>(new Map());
  const peerConnections = new Map(); 
  const [connectionState, setConnectionState] = useState('disconnected');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isLocked, setIsLocked] = useState(localStorage.getItem(CONSTANT.IS_LOCKED) === 'true');
  

  useEffect(() => {
    const sfu = sfuSocket;
    sfu.connect();

    const userName = localStorage.getItem(CONSTANT.USER_NAME);
    // Khởi tạo PeerJS
    peer.current = new Peer(userName); 

    // Lấy media stream của người dùng
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { max: 25 }
      }, 
      audio: true 
    })
      .then(localStream => {
        localStreamRef.current = localStream;
        setStreams([{ id: 'local', stream: localStream }]);

        // Khi PeerJS kết nối, tham gia phòng SFU
        peer.current?.on('open', (id) => {
          console.log('PeerJS connected with ID:', id);
          if (isLocked) {
            sfu.emit('sfu:join', { roomId, peerId: id, password: localStorage.getItem(CONSTANT.PASSWORD) });
          } else {
            sfu.emit('sfu:join', { roomId, peerId: id });
          }
          
          // Publish local stream
          const streamId = `stream_${id}_${Date.now()}`;
          publishedStreams.current.set(streamId, {
            peerId: id,
            metadata: { video: true, audio: true }
          });
          
          sfu.emit('sfu:publish', {
            streamId,
            metadata: { video: true, audio: true }
          });
        });

        // Xử lý danh sách streams hiện có
        sfu.on('sfu:streams', (availableStreams: any[]) => {
          console.log('Available streams:', availableStreams);
          availableStreams.forEach(stream => {
            // Đăng ký nhận streams
            sfu.emit('sfu:subscribe', { streamId: stream.streamId });
          });
        });

        // Xử lý khi có stream mới được thêm vào
        sfu.on('sfu:stream-added', (stream: any) => {
          console.log('New stream added:', stream);
          toast.success(`${stream.publisherId} đã tham gia phòng họp`)
          const { streamId, publisherId, metadata } = stream;
          if (metadata.type === 'screen') {
            console.log('Received screen share stream:', streamId, 'from', publisherId);
          }
          // Đăng ký nhận stream mới
          sfu.emit('sfu:subscribe', { streamId: streamId });
        });

        // Xử lý yêu cầu subscriber
        sfu.on('sfu:subscriber', (data: { streamId: string, subscriberId: string }) => {
          console.log('New subscriber for our stream:', data);
          // Tạo peer connection mới cho subscriber
          if (localStreamRef.current) {
            const conn = peer.current?.call(data.subscriberId, localStreamRef.current);
            conn?.on('stream', (remoteStream) => {
              // Không cần xử lý ở đây vì chúng ta là publisher
            });
          } else {
            console.error('Cannot call subscriber: local stream ref is null');
          }
        });

        sfu.on('sfu:error', (error) => {
          console.log('SFU error:', error);
          
          // If there's a password error, redirect to home page
          if (error.code === 'ROOM_PASSWORD_REQUIRED' || 
              error.code === 'INVALID_ROOM_PASSWORD') {
            toast.error(`Lỗi truy cập phòng: ${error.message}`);
            
            // Clear stored password as it's invalid
            localStorage.removeItem(CONSTANT.PASSWORD);
            localStorage.removeItem(CONSTANT.IS_LOCKED);
            
            // Navigate back to room selection page
            window.location.href = '/room';
          }
        });

        sfu.on('sfu:lock-success', ({ roomId, message }: { roomId: string, message: string }) => {
          console.log('Room locked:', roomId, 'message:', message);
          setIsLocked(true);
          toast.success("Phòng đã được khoá");
        });

        sfu.on('sfu:unlock-success', ({ roomId, message }: { roomId: string, message: string }) => {
          console.log('Room unlocked:', roomId, 'message:', message);
          setIsLocked(false);
          toast.success("Phòng đã được mở khóa");
        });

        // Xử lý tín hiệu WebRTC
        sfu.on('sfu:signal', (data: { streamId: string, peerId: string, signal: any }) => {
          console.log('Received signal:', data);
          // Xử lý tín hiệu nếu cần
        });

        // Khi peer khác rời đi
        sfu.on('sfu:peer-left', ({ peerId }: { peerId: string }) => {
          console.log('Peer left:', peerId);
          toast.warning(`${peerId} đã rời phòng họp`)
          
          // Chỉ xóa stream nếu peerId hoàn toàn khớp, không xóa khi còn các stream khác của người dùng
          setStreams(prev => prev.filter(p => p.id !== peerId));
        });

        // Khi stream bị xóa
        sfu.on('sfu:stream-removed', ({ streamId, publisherId }: { streamId: string, publisherId: string }) => {
          console.log('Stream removed:', streamId, 'from peer:', publisherId);
          
          // Chỉ xóa stream cụ thể, giữ lại các stream khác
          setStreams(prev => {
            // Kiểm tra nếu streamId chứa 'screen', chỉ xóa stream màn hình
            if (streamId.includes('screen')) {
              return prev.filter(p => p.id !== `screen_${publisherId}` && p.id !== 'screen-local');
            }
            
            // Nếu là stream thông thường, giữ nguyên stream màn hình
            return prev.filter(p => p.id !== publisherId);
          });
        });

        // Xử lý cuộc gọi đến (từ publishers)
        peer.current?.on('call', (incomingCall) => {
          console.log('Incoming call:', incomingCall);
          incomingCall.answer(localStreamRef.current || new MediaStream());
          
          // Lưu trữ kết nối để dọn dẹp sau này
          peerConnections.set(incomingCall.peer, incomingCall);
          
          incomingCall.on('stream', remoteStream => {
            console.log('Received remote stream from:', incomingCall.peer);
            
            // Kiểm tra metadata từ PeerJS connection nếu có
            // Hoặc heuristic check xem có phải screen share không
            const isScreenShare = incomingCall.metadata?.type === 'screen' || 
                                  incomingCall.peer.includes('screen') ||
                                  remoteStream.getVideoTracks().length > 0 && 
                                  remoteStream.getVideoTracks()[0].label.toLowerCase().includes('screen');
            
            const streamId = isScreenShare 
              ? `screen_${incomingCall.peer}` // Prefix 'screen_' cho stream màn hình
              : incomingCall.peer;            // ID thông thường cho stream camera
            
            console.log('Adding stream with ID:', streamId, 'isScreenShare:', isScreenShare);
            
            setStreams(prev => {
              // Kiểm tra nếu stream đã tồn tại với ID này
              if (!prev.find(p => p.id === streamId)) {
                return [...prev, { id: streamId, stream: remoteStream }];
              }
              return prev;
            });
          });
          
          // Xử lý khi kết nối bị đóng
          incomingCall.on('close', () => {
            console.log('Call closed:', incomingCall.peer);
            peerConnections.delete(incomingCall.peer);
            
            // Kiểm tra nếu kết nối đóng là của chia sẻ màn hình
            const isScreenShareConnection = incomingCall.metadata?.type === 'screen' || 
                                          incomingCall.peer.includes('screen');
            
            if (isScreenShareConnection) {
              // Chỉ xóa stream chia sẻ màn hình
              setStreams(prev => prev.filter(p => 
                p.id !== `screen_${incomingCall.peer.replace('_screen', '')}`
              ));
            } else {
              // Nếu là kết nối thông thường, xóa stream thông thường
              setStreams(prev => prev.filter(p => 
                p.id !== incomingCall.peer
              ));
            }
          });
        });

        sfu.on('connect', () => {
          setConnectionState('connected');
          console.log('Connected to SFU server');
        });
        
        sfu.on('disconnect', () => {
          setConnectionState('disconnected');
          console.log('Disconnected from SFU server');
        });
        
        // Xử lý reconnection
        sfu.on('reconnect', (attemptNumber) => {
          console.log(`Reconnected after ${attemptNumber} attempts`);
          
          // Khi reconnect, cần join lại room
          if (peer.current?.id) {
            // Check if room is locked and include password if it is
            if (isLocked) {
              sfu.emit('sfu:join', { 
                roomId, 
                peerId: peer.current.id,
                password: localStorage.getItem(CONSTANT.PASSWORD)
              });
            } else {
              sfu.emit('sfu:join', { roomId, peerId: peer.current.id });
            }
            
            // Re-publish streams if needed
            publishedStreams.current.forEach((metadata, streamId) => {
              sfu.emit('sfu:publish', {
                streamId,
                metadata: metadata.metadata
              });
            });
          }
        });
      })
      .catch(err => {
        console.error('Failed to get user media:', err);
      });

    return () => {
      // Cleanup other resources
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (peer.current) {
        peer.current.destroy();
      }
      
      // Ngừng publish streams
      publishedStreams.current.forEach((_, streamId) => {
        sfu.emit('sfu:unpublish', { streamId });
      });
      
      // Chỉ disconnect trong một số trường hợp, ví dụ:
      // - Khi rời khỏi phòng hoàn toàn
      // - Khi xảy ra lỗi socket
      sfu.disconnect();
      
      // Dọn dẹp tất cả kết nối peer
      peerConnections.forEach((conn) => {
        conn.close();
      });
      peerConnections.clear();
      
      // Xóa tất cả event listeners
      sfu.off('sfu:streams');
      sfu.off('sfu:stream-added');
      sfu.off('sfu:subscriber');
      sfu.off('sfu:stream-updated');
      sfu.off('sfu:signal');
      sfu.off('sfu:peer-left');
      sfu.off('sfu:stream-removed');
    };
  }, [roomId]);

  // Thêm chức năng bật/tắt camera
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        
        // Cập nhật metadata trên server
        publishedStreams.current.forEach((metadata, streamId) => {
          metadata.metadata.video = videoTrack.enabled;
          sfuSocket.emit('sfu:update', {
            streamId,
            metadata: metadata.metadata
          });
        });
        
        return videoTrack.enabled;
      }
    }
    return false;
  };

  // Thêm chức năng bật/tắt mic
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        
        // Cập nhật metadata trên server
        publishedStreams.current.forEach((metadata, streamId) => {
          metadata.metadata.audio = audioTrack.enabled;
          sfuSocket.emit('sfu:update', {
            streamId,
            metadata: metadata.metadata
          });
        });
        
        return audioTrack.enabled;
      }
    }
    return false;
  };

  const toggleLockRoom = (password?: string) => {
    if (isLocked) {
      sfuSocket.emit('sfu:unlock-room', { roomId });
      setIsLocked(!isLocked);
    } else {
      sfuSocket.emit('sfu:lock-room', { roomId, password });
      setIsLocked(!isLocked);
    }
  }

  // Thêm chức năng chia sẻ màn hình
  const toggleScreenShare = async () => {
    try {
      // Khai báo handler ở mức cao nhất của hàm
      let screenStreamId: string;
      const handleScreenShareSubscriber = (data: { streamId: string, subscriberId: string }) => {
        if (data.streamId === screenStreamId && screenStreamRef.current) {
          console.log('Handling screen share subscriber:', data.subscriberId);
          
          const conn = peer.current?.call(data.subscriberId, screenStreamRef.current, {
            metadata: { type: 'screen', isScreenShare: true }
          });
          
          if (conn) {
            peerConnections.set(data.subscriberId + '_screen', conn);
            
            console.log('Screen share peer connection established to:', data.subscriberId);
            
            conn.on('close', () => {
              console.log('Screen share peer connection closed:', data.subscriberId);
              peerConnections.delete(data.subscriberId + '_screen');
            });
          } else {
            console.error('Failed to create peer connection for screen sharing');
          }
        }
      };
      
      // If already sharing screen, stop
      if (isScreenSharing && screenStreamRef.current) {
        console.log("Stopping screen share");
        
        // Stop all tracks in screen share
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        
        // Find and unpublish screen sharing stream
        publishedStreams.current.forEach((metadata, streamId) => {
          if (metadata.type === 'screen') {
            sfuSocket.emit('sfu:unpublish', { streamId });
            publishedStreams.current.delete(streamId);
          }
        });
        
        // Quan trọng: Ngừng lắng nghe sự kiện 'sfu:subscriber' khi dừng chia sẻ màn hình
        sfuSocket.off('sfu:subscriber', handleScreenShareSubscriber);
        
        // Close only screen sharing peer connections
        peerConnections.forEach((conn, id) => {
          if (id.includes('_screen')) {
            conn.close();
            peerConnections.delete(id);
          }
        });
        
        // Only remove screen sharing streams from the UI
        setStreams(prev => prev.filter(stream => stream.id !== 'screen-local' && !stream.id.includes('screen_')));
        
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        return false;
      }
      
      // Start screen sharing
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always"
        } as MediaTrackConstraints,
        audio: false
      });
      
      screenStreamRef.current = screenStream;
      
      // Add screen stream to display list
      setStreams(prev => [...prev, { id: 'screen-local', stream: screenStream }]);
      
      // Publish screen sharing stream
      if (peer.current?.id) {
        screenStreamId = `screen_${peer.current.id}_${Date.now()}`;
        
        // Gắn handler vào sự kiện subscriber
        sfuSocket.on('sfu:subscriber', handleScreenShareSubscriber);
        
        publishedStreams.current.set(screenStreamId, {
          peerId: peer.current.id,
          metadata: { video: true, audio: false },
          type: 'screen'
        });
        
        sfuSocket.emit('sfu:publish', {
          streamId: screenStreamId,
          metadata: { video: true, audio: false, type: 'screen', isScreenShare: true }
        });
        
        // Cập nhật trạng thái trước khi log
        setIsScreenSharing(true);
        
        // Sử dụng tham chiếu thay vì trạng thái để log
        console.log("updated isScreenSharing to: true");
        
        screenStream.getVideoTracks()[0].onended = () => {
          console.log("Screen sharing ended by user");
          
          screenStream.getTracks().forEach(track => track.stop());
          
          sfuSocket.emit('sfu:unpublish', { streamId: screenStreamId });
          publishedStreams.current.delete(screenStreamId);
          
          // Ngừng lắng nghe sự kiện 'sfu:subscriber' cho chia sẻ màn hình
          sfuSocket.off('sfu:subscriber', handleScreenShareSubscriber);
          
          peerConnections.forEach((conn, id) => {
            if (id.includes('_screen')) {
              conn.close();
              peerConnections.delete(id);
            }
          });
          
          screenStreamRef.current = null;
          setIsScreenSharing(false);
          
          // Chỉ loại bỏ stream chia sẻ màn hình, không ảnh hưởng đến stream video thông thường
          setStreams(prev => prev.filter(stream => stream.id !== 'screen-local' && !stream.id.includes('screen_')));
        };
      }
      
      return true;
    } catch (error) {
      console.error('Error sharing screen:', error);
      return false;
    }
  };

  return { 
    streams,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    isScreenSharing,
    toggleLockRoom,
    isLocked
  };
}