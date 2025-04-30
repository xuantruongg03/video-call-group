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
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";

export const ParticipantsList = ({ roomId }: { roomId: string }) => {

  const [isCreator, setIsCreator] = useState(false);
  const { handleRemoveUser, users } = useUser(roomId);
  const room = useSelector((state: any) => state.room);
  const myName = room.username;

  useEffect(() => {
    const myData = users?.find(user => user.peerId === myName);
    if (myData?.isCreator) {
      setIsCreator(true);
    }
  }, [users, myName]);

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
            {users?.length}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Người tham gia</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {users?.map((user) => (
            <div
              key={user.peerId}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary"
            >
              <span className="text-sm">{user.peerId === myName ? user.peerId + " - Bạn" : user.peerId}</span>
              {user.peerId !== myName && isCreator && (
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
};