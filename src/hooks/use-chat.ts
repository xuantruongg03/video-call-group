// src/hooks/use-chat.ts
import { useState, useEffect } from 'react';
import { sfuSocket } from './use-call';

export interface Message {
  id: string;
  roomId: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export function useChat(roomId: string, userName: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  
  useEffect(() => {
    // Đảm bảo socket đã kết nối trước khi sử dụng
    if (!sfuSocket.connected) {
      sfuSocket.connect();
    }
    
    // Tham gia phòng chat
    sfuSocket.emit('chat:join', { roomId, userName });
    
    // Lắng nghe tin nhắn mới
    const handleNewMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
    };
    
    // Lắng nghe lịch sử tin nhắn
    const handleChatHistory = (history: Message[]) => {
      if (Array.isArray(history)) {
        setMessages(history);
      } else {
        console.warn('Received non-array chat history:', history);
        setMessages([]);
      }
    };
    
    // Đăng ký sự kiện
    sfuSocket.on('chat:message', handleNewMessage);
    sfuSocket.on('chat:history', handleChatHistory);
    
    return () => {
      // Rời phòng chat khi component unmount
      sfuSocket.emit('chat:leave', { roomId });
      
      // Hủy đăng ký sự kiện
      sfuSocket.off('chat:message', handleNewMessage);
      sfuSocket.off('chat:history', handleChatHistory);
      
      // Không ngắt kết nối socket ở đây vì nó vẫn được sử dụng bởi useCall
    };
  }, [roomId, userName]);
  
  // Hàm gửi tin nhắn
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
  
  return {
    messages,
    sendMessage
  };
}