import { store } from '../store.js';
import { computed } from '/js/vue.esm-browser.js';

export default {
    template: `
    <!-- 遮罩层：毛玻璃背景 -->
    <Transition name="scale">
    <div v-if="store.task.visible" 
         style="position:fixed; inset:0; z-index:3000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.45); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);">

        <div class="progress-card">
            <!-- 标题 -->
            <div class="progress-card-title">
                <div class="progress-icon-ring">
                    <i class="fa-solid" :class="iconClass"></i>
                </div>
                <h5 class="mb-0 fw-bold">{{ store.task.title }}</h5>
            </div>

            <!-- 自定义进度条 -->
            <div class="progress-track">
                <div class="progress-fill" :style="{ width: clampedPercent + '%' }"></div>
            </div>

            <div class="d-flex justify-content-between align-items-center mt-2">
                <span class="progress-msg text-truncate">{{ store.task.message }}</span>
                <div class="d-flex align-items-center gap-2">
                    <span class="progress-pct" v-if="store.task.percent > 0">{{ store.task.percent.toFixed(0) }}%</span>
                    <button v-if="store.task.canCancel" class="btn btn-sm btn-outline-danger py-0 px-2" @click="handleCancel" style="height: 24px; line-height: 1;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        </div>

    </div>
    </Transition>
    `,
    setup() {
        const clampedPercent = computed(() => Math.min(100, Math.max(0, store.task.percent)));
        const iconClass = computed(() => {
            const title = (store.task.title || '').toLowerCase();
            if (title.includes('更新') || title.includes('update')) return 'fa-arrow-up-from-bracket';
            if (title.includes('回档') || title.includes('restore')) return 'fa-clock-rotate-left';
            if (title.includes('上传') || title.includes('upload')) return 'fa-cloud-arrow-up';
            if (title.includes('下载') || title.includes('download')) return 'fa-cloud-arrow-down';
            return 'fa-spinner fa-spin';
        });

        const handleCancel = () => {
            if (store.task.onCancel) store.task.onCancel();
        };

        return { store, clampedPercent, iconClass, handleCancel };
    }
};