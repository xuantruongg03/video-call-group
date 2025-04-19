import roomService from "@/services/room";
import { useMutation } from "@tanstack/react-query";

const lockRoomRequest = async (params: { roomId: string, creatorId: string, password: string }) => {
    const response = await roomService.lockRoom(params);
    return response;
}

const useLockRoom = () => {
    const { isPending, mutateAsync: lockRoomMutation } = useMutation({
        mutationFn: (params: { roomId: string, creatorId: string, password: string }) => lockRoomRequest(params),
    })
    return { isPending, lockRoomMutation }
}

export default useLockRoom;

