import { useMutation } from "@tanstack/react-query";
import roomService from "../services/room";

const checkUsername = async (params: {username: string, roomId: string}) => {
    const response = await roomService.checkUsername(params);
    return response;
};

const useCheckUsername = () => {
   const {isPending, mutateAsync: checkUsernameMutation} = useMutation({
    mutationFn: (params: {username: string, roomId: string}) => checkUsername(params),
   })
   return {isPending, checkUsernameMutation};
};

export default useCheckUsername;
