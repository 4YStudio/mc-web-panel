import { ref } from '/js/vue.esm-browser.js';
import { store } from './store.js';
import { messages } from './i18n.js';

// Simple translation helper for non-component files
const t = (key) => {
    const keys = key.split('.');
    let value = messages[store.lang];
    for (const k of keys) {
        value = value?.[k];
        if (!value) return key;
    }
    return value;
};

export const toasts = ref([]);

export const removeToast = (id) => {
    toasts.value = toasts.value.filter(t => t.id !== id);
};

export const showToast = (msg, type = 'success') => {
    const id = Date.now();
    toasts.value.push({ id, message: msg, type });
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