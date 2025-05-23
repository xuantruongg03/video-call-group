import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { sfuSocket } from "@/hooks/use-call";
import useUser from "@/hooks/use-user";
import { FileSpreadsheet, Users, UserX } from "lucide-react";
import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";

export const ParticipantsList = React.memo(({ roomId }: { roomId: string }) => {
  const room = useSelector((state: any) => state.room);
  const { isCreator, username: myName } = room;
  const { handleRemoveUser, users } = useUser(roomId);
  const log = useSelector((state: any) => state.log);
  const { isMonitorActive } = log;
  
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

  const handleDownloadUserLog = async (userId: string) => {
    if (!isCreator) {
      toast.error("Bạn không có quyền tải xuống log người dùng");
      return;
    }

    try {
      sfuSocket.emit(
        "sfu:download-user-log",
        {
          roomId,
          peerId: userId,
          creatorId: myName,
        },
        (file: any) => {
          if (file && file.success) {
            window.URL.revokeObjectURL(file.file);
            const blob = new Blob([file.file], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `behavior-logs-${roomId}-${userId}-${new Date()
              .toISOString()
              .slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            }, 100);

            toast.success(`Đã tải xuống file log của người dùng ${userId}`);
          } else if (file && !file.success) {
            toast.error(file.error || "Không thể tải xuống file log");
          }
        }
      );
    } catch (error) {
      console.error('Download user log error:', error);
      toast.error("Không thể tải xuống log người dùng");
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
                <div className="flex gap-2">
                  {isMonitorActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => handleDownloadUserLog(user.peerId)}
                      title="Tải xuống log hành vi người dùng"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveParticipant(user.peerId)}
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
});