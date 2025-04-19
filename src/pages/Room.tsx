import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import useCheckRoomStatus from "@/hooks/use-check-room-status";
import useCheckUsername from "@/hooks/use-check-username";
import useVerifyRoom from "@/hooks/use-verify-room";
import CONSTANT from "@/lib/constant";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Room = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const { isPending, checkUsernameMutation } = useCheckUsername();
  const { checkRoomStatusMutation, isPending: isRoomStatusPending } = useCheckRoomStatus();
  const { verifyRoomMutation, isPending: isVerifyRoomPending } = useVerifyRoom();

  const checkUsername = async () => {
    const checkUsername = await checkUsernameMutation({ username: userName, roomId: roomId });
    return checkUsername;
  }

  const handleCreateRoom = async () => {  
    localStorage.setItem(CONSTANT.USER_NAME, userName);
    const newRoomId = `${Math.random().toString(36).substring(2, 9)}`;
    navigate(`/room/${newRoomId}`);
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const isUsernameValid = await checkUsername();
    if (!isUsernameValid.data.success) {
      toast.error("Tên người dùng đã tồn tại trong phòng này! Vui lòng chọn tên khác.");
      return;
    }
    const roomStatus = await checkRoomStatusMutation({ roomId: roomId });
    if (roomStatus.data.locked) {
      //Show modal enter password
      const password = prompt("Nhập mật khẩu phòng");
      if (!password) {
        toast.error("Mật khẩu không được để trống!");
        return;
      }
      const verifyRoom = await verifyRoomMutation({ roomId: roomId, password: password });
      if (verifyRoom.data.valid) {
        localStorage.setItem(CONSTANT.USER_NAME, userName);
        localStorage.setItem(CONSTANT.PASSWORD, password);
        localStorage.setItem(CONSTANT.IS_LOCKED, "true");
        navigate(`/room/${roomId}`);
      }
    }
    else {
      localStorage.setItem(CONSTANT.USER_NAME, userName);
      navigate(`/room/${roomId}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Video Call Room</CardTitle>
          <CardDescription className="text-center">
            Tạo phòng mới hoặc tham gia phòng có sẵn
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Nhập tên của bạn"
            className="w-full"
          />

          <Button
            onClick={handleCreateRoom}
            className="w-full text-lg py-6"
            size="lg"
            disabled={!userName.trim() || isPending}
          >
            {/* {isPending ? <span className="loader"></span> : "Tạo Phòng Mới"} */}
            Tạo Phòng Mới
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Hoặc</span>
            </div>
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <Input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Nhập Room ID"
              className="w-full"
            />
            <Button type="submit" variant="outline" className="w-full" size="lg" disabled={!userName.trim() || isPending || !roomId.trim()}>
              {isPending ? <span className="loader"></span> : "Tham Gia Phòng"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Room;
