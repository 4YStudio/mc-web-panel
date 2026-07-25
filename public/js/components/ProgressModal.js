import { store } from '../store.js';
import { computed } from '/js/vue.esm-browser.js';

export default {
    template: `
    <!-- 遮罩层：毛玻璃背景 -->
    <Transition name="scale">
    <div v-if="store.task.visible" 
         style="position:fixed; inset:0; z-index:3000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.55); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);">

        <div class="progress-card shadow-lg p-4" style="width: 450px; background: var(--c-surface, #ffffff); border: 1px solid var(--c-border); border-radius: 20px; color: var(--c-text-primary);">
            <!-- 标题 & 图标 -->
            <div class="d-flex align-items-center justify-content-between mb-3">
                <div class="d-flex align-items-center gap-3">
                    <div class="progress-icon-ring d-flex align-items-center justify-content-center" style="width: 40px; height: 40px; border-radius: 50%; background: var(--c-primary-glow, rgba(77, 142, 247, 0.12)); color: var(--c-primary);">
                        <i class="fa-solid fa-lg" :class="iconClass"></i>
                    </div>
                    <h5 class="mb-0 fw-bold" style="color: var(--c-text-primary);">{{ store.task.title }}</h5>
                </div>
                <!-- 百分比 -->
                <span class="fw-bold fs-5" style="color: var(--c-primary);" v-if="store.task.percent >= 0">{{ store.task.percent.toFixed(0) }}%</span>
                <span class="spinner-border spinner-border-sm" style="color: var(--c-primary);" v-else></span>
            </div>

            <!-- 当前正在处理的文件名 -->
            <div v-if="store.task.fileName" class="mb-3">
                <div style="font-size: 0.75rem; color: var(--c-text-secondary);">当前处理文件:</div>
                <div class="text-truncate fw-semibold small" style="font-size: 0.85rem; color: var(--c-text-primary);" :title="store.task.fileName">
                    {{ store.task.fileName }}
                </div>
            </div>

            <!-- 进度条 -->
            <div class="progress-track mb-3" style="height: 8px; background: var(--c-border-subtle, rgba(0,0,0,0.08)); border-radius: 4px; overflow: hidden;">
                <div class="progress-fill" :style="{ width: clampedPercent + '%' }" style="height: 100%; background: var(--c-primary, #4d8ef7); border-radius: 4px; transition: width 0.2s ease;"></div>
            </div>

            <!-- 大小与速度 -->
            <div class="d-flex justify-content-between align-items-center mt-2">
                <span class="progress-msg small text-truncate" style="max-width: 60%; color: var(--c-text-secondary);">{{ sizeMsg }}</span>
                <span class="progress-pct fw-bold small" style="color: var(--c-primary);" v-if="formattedSpeed">{{ formattedSpeed }}</span>
            </div>

            <!-- 取消按钮 -->
            <div v-if="store.task.canCancel" class="mt-4 border-top pt-3 d-flex justify-content-end" style="border-top: 1px solid var(--c-border) !important;">
                <button class="btn btn-sm btn-outline-danger px-3 py-1.5 shadow-sm fw-bold d-flex align-items-center gap-2" @click="handleCancel" style="border-radius: 10px;">
                    <i class="fa-solid fa-ban"></i>
                    <span>取消</span>
                </button>
            </div>
        </div>

    </div>
    </Transition>
    `,
    setup() {
        const clampedPercent = computed(() => {
            const p = store.task.percent;
            if (p === undefined || p === null || p < 0) return 0;
            return Math.min(100, Math.max(0, p));
        });

        const iconClass = computed(() => {
            const title = (store.task.title || '').toLowerCase();
            if (title.includes('更新') || title.includes('update')) return 'fa-arrow-up-from-bracket';
            if (title.includes('回档') || title.includes('restore')) return 'fa-clock-rotate-left';
            if (title.includes('上传') || title.includes('upload')) return 'fa-cloud-arrow-up';
            if (title.includes('下载') || title.includes('download')) return 'fa-cloud-arrow-down';
            if (title.includes('压缩') || title.includes('compress')) return 'fa-file-zipper';
            if (title.includes('解压') || title.includes('extract') || title.includes('decompress')) return 'fa-file-shield';
            return 'fa-spinner fa-spin';
        });

        const formatSize = (bytes) => {
            if (bytes === undefined || bytes === null || bytes < 0) return '';
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const sizeMsg = computed(() => {
            if (store.task.processedSize > 0 || store.task.totalSize > 0) {
                return `${formatSize(store.task.processedSize)} / ${formatSize(store.task.totalSize)}`;
            }
            return store.task.message || '';
        });

        const formattedSpeed = computed(() => {
            const speed = store.task.speed;
            if (speed === undefined || speed === null || speed <= 0) return '';
            let prefix = '速度: ';
            const title = (store.task.title || '').toLowerCase();
            if (title.includes('上传') || title.includes('upload')) prefix = '上传速度: ';
            else if (title.includes('下载') || title.includes('download')) prefix = '下载速度: ';
            else if (title.includes('压缩') || title.includes('compress')) prefix = '压缩速度: ';
            else if (title.includes('解压') || title.includes('extract') || title.includes('decompress')) prefix = '解压速度: ';

            if (speed >= 1024 * 1024) {
                return prefix + (speed / 1024 / 1024).toFixed(2) + ' MB/s';
            } else {
                return prefix + (speed / 1024).toFixed(0) + ' KB/s';
            }
        });

        const handleCancel = () => {
            if (store.task.onCancel) store.task.onCancel();
        };

        return { store, clampedPercent, iconClass, handleCancel, formattedSpeed, sizeMsg };
    }
};