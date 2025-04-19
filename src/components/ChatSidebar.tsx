import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Send, X } from "lucide-react";
import { IoMdCloseCircleOutline } from "react-icons/io";
import { useChat } from "@/hooks/use-chat";
import CONSTANT from "@/lib/constant";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChatSidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  roomId: string;
}

export const ChatSidebar = ({ isOpen, setIsOpen, roomId }: ChatSidebarProps) => {
  const [newMessage, setNewMessage] = useState("");
  const username = localStorage.getItem(CONSTANT.USER_NAME);
  const { messages, sendMessage } = useChat(roomId, username ?? '');
  const isMobile = useIsMobile();


  const handleSend = () => {
    if (newMessage.trim()) {
      sendMessage(newMessage);
      setNewMessage("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`${
      isMobile 
        ? 'fixed inset-0 z-50 bg-white' 
        : 'fixed right-0 top-0 h-screen w-80 bg-white border-l border-gray-200'
    } flex flex-col`}>
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Group Chat</h2>
        {isMobile && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${
              message.sender === "You" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.sender === "You"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100"
              }`}
            >
              <p className="text-sm font-semibold">{message.sender}</p>
              <p className="break-words">{message.text}</p>
              <p className="text-xs opacity-70 mt-1">{message.timestamp}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
