export const api = {
    get: (url) => axios.get(url),
    // 修改：支持传入 config (用于 onUploadProgress)
    post: (url, data, config = {}) => axios.post(url, data, config),
    delete: (url) => axios.delete(url),
    put: (url, data) => axios.put(url, data)
};