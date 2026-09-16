import { ref, watch, nextTick, onMounted, onBeforeUnmount } from '/js/vue.esm-browser.js';
import { api } from '../api.js';

export default {
    name: 'SlideCaptchaModal',
    props: {
        modelValue: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue', 'success', 'close'],
    template: `
    <Transition name="fade">
        <div v-if="modelValue" class="slide-captcha-backdrop" @click.self="handleClose">
            <div class="slide-captcha-card shadow-lg animate-in" @click.stop>
                <!-- 头部 -->
                <div class="slide-captcha-header d-flex align-items-center justify-content-between p-3 border-bottom">
                    <div class="d-flex align-items-center gap-2">
                        <i class="fa-solid fa-puzzle-piece text-primary fs-5"></i>
                        <span class="fw-bold fs-6">{{ $t('login.captcha_modal_title') }}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-link text-secondary p-1" :title="$t('login.refresh_captcha')" @click="loadCaptcha" :disabled="loading || verified">
                            <i class="fa-solid fa-rotate-right" :class="{ 'fa-spin': loading }"></i>
                        </button>
                        <button class="btn btn-sm btn-link text-secondary p-1" title="关闭" @click="handleClose" :disabled="verified">
                            <i class="fa-solid fa-xmark fs-5"></i>
                        </button>
                    </div>
                </div>

                <!-- 内容区域 -->
                <div class="slide-captcha-body p-3">
                    <!-- 图片展示区 -->
                    <div class="slide-image-wrapper position-relative rounded overflow-hidden mb-3 user-select-none" ref="imgAreaRef" :style="{ height: imageAreaHeight + 'px' }">
                        <!-- 背景大图 -->
                        <img v-if="captchaData && captchaData.bgImage" :src="captchaData.bgImage" class="w-100 h-100 object-fit-cover d-block" draggable="false" alt="captcha-bg">

                        <!-- 滑块切片 -->
                        <div v-if="captchaData && captchaData.slideImage && !verified"
                             class="slide-block-piece position-absolute"
                             :style="{
                                 top: slideTopPx + 'px',
                                 left: sliderLeftPx + 'px',
                                 width: pieceSizePx + 'px',
                                 height: pieceSizePx + 'px'
                             }">
                            <img :src="captchaData.slideImage" class="w-100 h-100 d-block" draggable="false" alt="captcha-slice">
                        </div>

                        <!-- 加载中蒙层 -->
                        <div v-if="loading" class="slide-status-overlay d-flex flex-column align-items-center justify-content-center bg-dark bg-opacity-50 text-white">
                            <div class="spinner-border spinner-border-sm mb-2 text-primary" role="status"></div>
                            <span class="small fw-medium">{{ $t('login.loading_captcha') }}</span>
                        </div>

                        <!-- 验证成功蒙层 -->
                        <div v-if="verified" class="slide-status-overlay success d-flex flex-column align-items-center justify-content-center bg-success bg-opacity-75 text-white">
                            <i class="fa-solid fa-circle-check fs-1 mb-2 animate-bounce"></i>
                            <span class="fw-bold">{{ $t('login.verified_success') }}</span>
                        </div>

                        <!-- 验证失败提示条 -->
                        <div v-if="isError" class="slide-error-banner position-absolute bottom-0 start-0 end-0 py-1 px-3 bg-danger bg-opacity-90 text-white text-center small fw-semibold">
                            <i class="fa-solid fa-triangle-exclamation me-1"></i>
                            {{ errorMsg || $t('login.verify_failed') }}
                        </div>
                    </div>

                    <!-- 滑动轨道 -->
                    <div class="slide-track position-relative rounded-pill overflow-hidden user-select-none" ref="trackRef" :class="{ 'is-dragging': isDragging, 'is-success': verified, 'is-error': isError }">
                        <!-- 拖动进度填充 -->
                        <div class="slide-track-fill position-absolute start-0 top-0 bottom-0" :style="{ width: (sliderLeftPx + (pieceSizePx / 2)) + 'px' }"></div>
                        
                        <!-- 轨道提示文字 -->
                        <div class="slide-track-tip text-center w-100 small position-relative" :class="{ 'opacity-0': isDragging }">
                            <span v-if="verified" class="text-success fw-bold">{{ $t('login.verified_success') }}</span>
                            <span v-else class="text-secondary fw-medium">{{ $t('login.drag_tip') }}</span>
                        </div>

                        <!-- 滑块拖动手柄 -->
                        <div class="slide-handler position-absolute top-0 bottom-0 d-flex align-items-center justify-content-center shadow-sm"
                             ref="handlerRef"
                             :style="{ transform: 'translateX(' + sliderLeftPx + 'px)', width: handlerWidth + 'px' }"
                             @mousedown="onDragStart"
                             @touchstart="onTouchStart">
                            <i v-if="verified" class="fa-solid fa-check text-white"></i>
                            <i v-else-if="isError" class="fa-solid fa-xmark text-white"></i>
                            <i v-else class="fa-solid fa-angles-right text-primary"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Transition>
    `,
    setup(props, { emit }) {
        const loading = ref(false);
        const verified = ref(false);
        const isError = ref(false);
        const isDragging = ref(false);
        const errorMsg = ref('');

        const captchaData = ref(null);
        const imgAreaRef = ref(null);
        const trackRef = ref(null);
        const handlerRef = ref(null);

        const sliderLeftPx = ref(0);
        const slideTopPx = ref(0);
        const pieceSizePx = ref(48);
        const handlerWidth = ref(44);
        const imageAreaHeight = ref(200);

        let renderWidth = 320;
        let ratio = 1;
        let maxDrag = 270;
        let startClientX = 0;
        let startClientY = 0;
        let startTime = 0;
        let trackPoints = [];

        const resetState = () => {
            sliderLeftPx.value = 0;
            slideTopPx.value = 0;
            isDragging.value = false;
            isError.value = false;
            verified.value = false;
            errorMsg.value = '';
            trackPoints = [];
        };

        const calculateMetrics = () => {
            if (!imgAreaRef.value || !captchaData.value) return;
            renderWidth = imgAreaRef.value.clientWidth || 320;
            if (renderWidth <= 0) renderWidth = 320;
            const bgW = captchaData.value.bgWidth || 380;
            const bgH = captchaData.value.bgHeight || 240;
            const pSize = captchaData.value.pieceSize || 56;

            ratio = renderWidth / bgW;
            imageAreaHeight.value = Math.round(renderWidth * (bgH / bgW));
            slideTopPx.value = Math.round((captchaData.value.y || 0) * ratio);
            pieceSizePx.value = Math.round(pSize * ratio);
            handlerWidth.value = Math.max(40, Math.min(50, pieceSizePx.value));

            if (trackRef.value) {
                const trackWidth = trackRef.value.clientWidth;
                maxDrag = trackWidth - handlerWidth.value;
            }
        };

        const loadCaptcha = async () => {
            if (loading.value) return;
            resetState();
            loading.value = true;

            try {
                const res = await api.get('/api/auth/captcha');
                if (res.data && res.data.success) {
                    captchaData.value = res.data;
                    await nextTick();
                    setTimeout(() => {
                        calculateMetrics();
                    }, 50);
                } else {
                    isError.value = true;
                    errorMsg.value = res.data?.error || '加载验证码失败';
                }
            } catch (err) {
                isError.value = true;
                errorMsg.value = '验证码服务连接超时，请重试';
            } finally {
                loading.value = false;
            }
        };

        // 拖拽移动处理（公用）
        const handleDragMove = (clientX, clientY) => {
            if (!isDragging.value || verified.value) return;
            const deltaX = clientX - startClientX;
            const clampedX = Math.max(0, Math.min(maxDrag, deltaX));
            sliderLeftPx.value = clampedX;

            const now = Date.now();
            const relTime = now - startTime;
            const relY = clientY - startClientY;
            trackPoints.push([
                Math.round(clampedX / ratio),
                relY,
                relTime
            ]);
        };

        // 拖拽结束提交（公用）
        const handleDragEnd = async () => {
            if (!isDragging.value || verified.value) return;
            isDragging.value = false;

            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);

            if (!captchaData.value) return;

            const dragX = Math.round(sliderLeftPx.value / ratio);

            // 补充终点
            trackPoints.push([
                dragX,
                trackPoints.length ? trackPoints[trackPoints.length - 1][1] : 0,
                Date.now() - startTime
            ]);

            try {
                const res = await api.post('/api/auth/captcha/verify', {
                    captchaId: captchaData.value.captchaId,
                    dragX: dragX,
                    track: trackPoints
                });

                if (res.data && res.data.success && res.data.token) {
                    verified.value = true;
                    isError.value = false;
                    setTimeout(() => {
                        emit('success', { token: res.data.token });
                        emit('update:modelValue', false);
                    }, 650);
                } else {
                    isError.value = true;
                    errorMsg.value = res.data?.error || '拼图未对齐，请重新滑动';
                    setTimeout(() => {
                        loadCaptcha();
                    }, 850);
                }
            } catch (err) {
                isError.value = true;
                errorMsg.value = '网络错误，验证失败';
                setTimeout(() => {
                    loadCaptcha();
                }, 850);
            }
        };

        // 鼠标事件
        const onDragStart = (e) => {
            if (loading.value || verified.value || !captchaData.value) return;
            isDragging.value = true;
            isError.value = false;
            startClientX = e.clientX;
            startClientY = e.clientY;
            startTime = Date.now();
            trackPoints = [[0, 0, 0]];

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            handleDragMove(e.clientX, e.clientY);
        };

        const onMouseUp = () => {
            handleDragEnd();
        };

        // 触屏事件
        const onTouchStart = (e) => {
            if (loading.value || verified.value || !captchaData.value) return;
            const touch = e.touches[0];
            if (!touch) return;
            if (e.cancelable) e.preventDefault();
            isDragging.value = true;
            isError.value = false;
            startClientX = touch.clientX;
            startClientY = touch.clientY;
            startTime = Date.now();
            trackPoints = [[0, 0, 0]];

            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onTouchEnd);
        };

        const onTouchMove = (e) => {
            const touch = e.touches[0];
            if (!touch) return;
            e.preventDefault(); // 阻止页面滚动
            handleDragMove(touch.clientX, touch.clientY);
        };

        const onTouchEnd = () => {
            handleDragEnd();
        };

        const handleClose = () => {
            if (verified.value) return;
            emit('update:modelValue', false);
            emit('close');
        };

        watch(() => props.modelValue, (newVal) => {
            if (newVal) {
                loadCaptcha();
            } else {
                resetState();
            }
        });

        onMounted(() => {
            window.addEventListener('resize', calculateMetrics);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('resize', calculateMetrics);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        });

        return {
            loading,
            verified,
            isError,
            isDragging,
            errorMsg,
            captchaData,
            imgAreaRef,
            trackRef,
            handlerRef,
            sliderLeftPx,
            slideTopPx,
            pieceSizePx,
            handlerWidth,
            imageAreaHeight,
            loadCaptcha,
            onDragStart,
            onTouchStart,
            handleClose
        };
    }
};
