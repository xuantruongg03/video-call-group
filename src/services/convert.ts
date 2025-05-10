import axios from "axios";
const SERVER_URL = import.meta.env.VITE_SERVER_URL;
const convertVideo = async (params: FormData) => {
    const response= await axios.post(`${SERVER_URL}/convert-video/convert`, params, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    })
    return response;
};

const convertVideoService = {   
    convertVideo
}

export default convertVideoService;