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
  
  return {
    messages,
    sendMessage
  };
}