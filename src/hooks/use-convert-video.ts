import convertVideoService from "@/services/convert";
import { useMutation } from "@tanstack/react-query";

const convertVideo = async (params: FormData) => {
    const response = await convertVideoService.convertVideo(params);
    return response;
};

function useConvertVideo() {
    const {isPending, mutateAsync: convertVideoMutation} = useMutation({
        mutationFn: (params: FormData) => convertVideo(params),
    })
    return {isPending, convertVideoMutation};
}

export default useConvertVideo;
