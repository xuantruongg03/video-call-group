import roomService from "@/services/room";
import { useMutation } from "@tanstack/react-query";

const checkRoomStatus = async (params: { roomId: string }) => {
  const response = await roomService.roomCheckStatus(params);
  return response;
};

const useCheckRoomStatus = () => {
  const { mutateAsync: checkRoomStatusMutation, isPending } = useMutation({
    mutationFn: (params: { roomId: string }) => checkRoomStatus(params),
  });
  return { checkRoomStatusMutation, isPending };
};

export default useCheckRoomStatus;
