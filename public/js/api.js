import { store } from './store.js';

// Add instanceId to all requests if set
axios.interceptors.request.use(config => {
    if (store.currentInstanceId) {
        if (config.method === 'get' || config.method === 'delete') {
            config.params = { ...config.params, instanceId: store.currentInstanceId };
        } else {
            if (config.data instanceof FormData) {
                config.data.append('instanceId', store.currentInstanceId);
            } else if (typeof config.data === 'object') {
                config.data = { ...config.data, instanceId: store.currentInstanceId };
            } else {
                config.params = { ...config.params, instanceId: store.currentInstanceId };
            }
        }
    }
    return config;
});

export const api = {
    get: (url, config = {}) => axios.get(url, config),
    post: (url, data, config = {}) => axios.post(url, data, config),
    delete: (url, config = {}) => axios.delete(url, config),
    put: (url, data, config = {}) => axios.put(url, data, config)
};