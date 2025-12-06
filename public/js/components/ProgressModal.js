import { store } from '../store.js';

export default {
    template: `
    <!-- 遮罩层 -->
    <div v-if="store.task.visible" class="modal-backdrop show" style="z-index: 3000; background-color: rgba(0,0,0,0.6);"></div>
    
    <!-- 模态框 -->
    <div v-if="store.task.visible" class="modal show d-block" tabindex="-1" style="z-index: 3001; padding-top: 10vh;">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content shadow-lg border-0">
                <div class="modal-body p-4">
                    <h5 class="mb-3 text-center">{{ store.task.title }}</h5>
                    
                    <!-- 进度条 -->
                    <div class="progress mb-2" style="height: 25px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
                             role="progressbar" 
                             :style="{width: store.task.percent + '%'}">
                             {{ store.task.percent.toFixed(0) }}%
                        </div>
                    </div>
                    
                    <div class="d-flex justify-content-between small text-muted mt-2">
                        <span class="text-truncate" style="max-width: 60%;">{{ store.task.message }}</span>
                        <span>{{ store.task.subMessage }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,
    setup() {
        return { store };
    }
};