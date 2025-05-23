import { useState, useEffect } from 'react';
import { sfuSocket } from './use-call';

export interface Message {
  id: string;
  roomId: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  isImage?: boolean;
}

export function useChat(roomId: string, userName: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  
  useEffect(() => {
    if (!sfuSocket.connected) {
      sfuSocket.connect();
    }
    
    sfuSocket.emit('chat:join', { roomId, userName });
    
    const handleNewMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
    };
    
    const handleChatHistory = (history: Message[]) => {
      if (Array.isArray(history)) {
        setMessages(history);
      } else {
        console.warn('Received non-array chat history:', history);
        setMessages([]);
      }
    };
    
    sfuSocket.on('chat:message', handleNewMessage);
    sfuSocket.on('chat:history', handleChatHistory);
    
    return () => {
      sfuSocket.emit('chat:leave', { roomId });
      
      sfuSocket.off('chat:message', handleNewMessage);
      sfuSocket.off('chat:history', handleChatHistory);
      
    };
  }, [roomId, userName]);
  
  const sendMessage = (text: string) => {
    if (text.trim()) {
      const message = {
        sender: userName,
        senderName: userName,
        text
      };
      
      sfuSocket.emit('chat:message', {
        roomId,
        message
      });
    }
  };
  
  const sendFileMessage = (file: File) => {
    // Chuyển file thành base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      
      // Chuẩn bị message với thông tin file
      const message = {
        sender: userName,
        senderName: userName,
        text: file.name, // Sử dụng tên file làm nội dung tin nhắn
        fileUrl: base64Data,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        isImage: file.type.startsWith('image/')
      };
      
      // Gửi qua websocket
      sfuSocket.emit('chat:file', {
        roomId,
        message
      });
    };
    
    reader.readAsDataURL(file);
  };
  
  return {
    messages,
    sendMessage,
    sendFileMessage
  };
}