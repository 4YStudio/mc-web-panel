import { ref } from '/js/vue.esm-browser.js';
import { store } from './store.js';
import { messages } from './i18n.js';

// Simple translation helper for non-component files
export const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = messages[store.lang];
    for (const k of keys) {
        value = value?.[k];
        if (!value) return key;
    }
    if (typeof value === 'string') {
        return value.replace(/{(\w+)}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
    }
    return value;
};

export const toasts = ref([]);

export const removeToast = (id) => {
    toasts.value = toasts.value.filter(t => t.id !== id);
};

export const showToast = (msg, type = 'success', params = {}) => {
    const id = Date.now();
    // Try to translate if it's a key, otherwise keep as is
    const translatedMsg = t(msg, params);
    // If t() returns the key itself (meaning no translation found) and msg has spaces, 
    // it's likely a hardcoded string, so just show it. 
    // But t() returns key if not found, so this logic is built-in to t() kind of, 
    // except t() splits by dot.
    // Let's just blindly try t(). If msg is "Error fetching", t("Error fetching") 
    // might look for messages["Error fetching"], which won't exist, so it returns "Error fetching".
    // This enables backward compatibility for hardcoded strings.

    toasts.value.push({ id, message: translatedMsg, type });
    setTimeout(() => removeToast(id), 3000);
};

export const formatLog = (log) => {
    return log.replace(/</g, "&lt;")
        .replace(/(\/INFO\])/g, '/<span class="log-info">INFO</span>]')
        .replace(/(\/WARN\])/g, '/<span class="log-warn">WARN</span>]')
        .replace(/(\/ERROR\])/g, '/<span class="log-error">ERROR</span>]')
        .replace(/(\[系统\])/g, `<span class="log-system">
        [${t('dashboard.system')}]
        </span>`);
};

// Global Modal State
export const modalData = ref({ title: '', message: '', mode: 'confirm', inputValue: '', options: [], placeholder: '', callback: null });
let modalInstance = null;

export const initModal = () => {
    const el = document.getElementById('confirmModal');
    if (el) modalInstance = new bootstrap.Modal(el);
};

export const openModal = (opts) => {
    modalData.value = {
        title: opts.title || t('common.confirm'),
        message: opts.message || '',
        mode: opts.mode || 'confirm',
        inputValue: opts.inputValue || '',
        options: opts.options || [],
        placeholder: opts.placeholder || '',
        callback: opts.callback
    };
    if (modalInstance) modalInstance.show();
};

export const confirmModalAction = () => {
    if (modalData.value.callback) modalData.value.callback(modalData.value.inputValue);
    if (modalInstance) modalInstance.hide();
};

/**
 * 等待面板重新上线
 * @param {string|number} targetPort 目标端口 (可选)
 * @returns {Promise<void>}
 */
export const waitForPanel = (targetPort = null) => {
    return new Promise((resolve) => {
        const check = async () => {
            try {
                let url = '/api/system/version';
                if (targetPort) {
                    const protocol = window.location.protocol;
                    const hostname = window.location.hostname;
                    url = `${protocol}//${hostname}:${targetPort}/api/system/version`;
                }
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                // 使用 fetch 探测。由于重启过程会有连接重置，所以 catch 错误并重试
                await fetch(url, { 
                    cache: 'no-store', 
                    mode: 'no-cors', 
                    signal: controller.signal 
                });
                clearTimeout(timeoutId);
                
                // 只要 fetch 没有抛出错误 (即使是 opaque 响应) 都说明服务已启动
                resolve();
            } catch (e) {
                setTimeout(check, 1000);
            }
        };
        // 初始等待 1.5s 确保旧进程已经开始关闭
        setTimeout(check, 1500);
    });
};