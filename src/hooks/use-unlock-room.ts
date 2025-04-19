import { useMutation } from "@tanstack/react-query"
import roomService from "@/services/room"

const unlockRoomRequest = async (params: { roomId: string, creatorId: string }) => {
    const response = await roomService.unlockRoom(params);
    return response;
}

const useUnlockRoom = () => {
    const { isPending, mutateAsync: unlockRoomMutation } = useMutation({
        mutationFn: (params: { roomId: string, creatorId: string }) => unlockRoomRequest(params),
    })
    return { isPending, unlockRoomMutation }
}

export default useUnlockRoom;   
