import { useMutation } from "@tanstack/react-query";
import roomService from "../services/room";

const verifyRoom = async (params: {roomId: string, password: string}) => {
    const response = await roomService.verifyRoom(params);
    return response;
};

const useVerifyRoom = () => {
   const {isPending, mutateAsync: verifyRoomMutation} = useMutation({
    mutationFn: (params: {roomId: string, password: string}) => verifyRoom(params),
   })
   return {isPending, verifyRoomMutation};
};

export default useVerifyRoom;
