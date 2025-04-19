import axios from "axios";
import { stringify } from "qs";

const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_SERVER_URL,
    headers: {
        "content-type": "application/json",
    },
    paramsSerializer: (params) => stringify(params, { encode: false }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hanldeError = (e: any) => {
    throw e;
};

export const uploadFile = async (file: File, url: string, method: string = "POST") => {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await axiosClient({
            method: method,
            url: url,
            data: formData,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response;
    } catch (error) {
        hanldeError(error);
    }
};

export const downloadFile = async (url: string, defaultFileName: string) => {
    const response = await fetch(url, {
        method: 'GET',
    });
    const contentDisposition = response.headers.get('Content-Disposition');
    const fileNameMatch = contentDisposition && contentDisposition.match(/filename="?(.+)"?/i);
    const fileName = fileNameMatch && fileNameMatch[1] ? fileNameMatch[1] : defaultFileName;
    const buffer = await response.arrayBuffer();
    return { buffer, fileName };
  };


axiosClient.interceptors.request.use(async (config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

axiosClient.interceptors.response.use((response) => {
    if (response && response.data) {
        return response.data;
    }
    return response;
}, hanldeError);

export default axiosClient;