import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import useUser from "@/hooks/use-user";
import { Users, UserX } from "lucide-react";
import { useSelector } from "react-redux";
import { toast } from "sonner";

export const ParticipantsList = React.memo(({ roomId }: { roomId: string }) => {
  // Lấy trạng thái isCreator từ Redux
  const room = useSelector((state: any) => state.room);
  const { isCreator, username: myName } = room;
  const { handleRemoveUser, users } = useUser(roomId);
  
  // Memoise danh sách người dùng để tránh re-render không cần thiết
  const usersList = useMemo(() => {
    if (!users) return [];
    return users.map(user => ({
      ...user,
      isMe: user.peerId === myName,
      displayName: user.peerId === myName 
        ? (user.isCreator ? `${user.peerId} - Bạn (Người tổ chức)` : `${user.peerId} - Bạn`) 
        : (user.isCreator ? `${user.peerId} - Người tổ chức` : user.peerId)
    }));
  }, [users, myName]);

  const userCount = useMemo(() => {
    return usersList.length;
  }, [usersList]);

  const handleRemoveParticipant = (peerId: string) => {
    if (isCreator) {
      handleRemoveUser(peerId);
    } else {
      toast.error("Bạn không có quyền xóa người tham gia");
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Users className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
            {userCount}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent showIcon>
        <SheetHeader>
          <SheetTitle>Người tham gia</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {usersList.map((user) => (
            <div
              key={user.peerId}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary"
            >
              <span className="text-sm">{user.displayName}</span>
              {!user.isMe && isCreator && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemoveParticipant(user.peerId)}
                >
                  <UserX className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
});