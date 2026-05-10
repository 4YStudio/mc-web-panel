import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch, Teleport } from '/js/vue.esm-browser.js';

export default {
    name: 'CustomSelect',
    props: {
        modelValue: {
            default: ''
        },
        options: {
            type: Array,
            default: () => []
        },
        placeholder: {
            type: String,
            default: ''
        },
        disabled: {
            type: Boolean,
            default: false
        },
        size: {
            type: String,
            default: '',
            validator: v => ['', 'sm', 'lg'].includes(v)
        },
        searchable: {
            type: Boolean,
            default: false
        },
        width: {
            type: String,
            default: ''
        }
    },
    emits: ['update:modelValue', 'change'],
    setup(props, { emit }) {
        const isOpen = ref(false);
        const searchText = ref('');
        const triggerRef = ref(null);
        const dropdownRef = ref(null);
        const searchInputRef = ref(null);
        const highlightIndex = ref(-1);
        const dropdownStyle = ref({});

        const normalizedOptions = computed(() => {
            return props.options.map(opt => {
                if (typeof opt === 'object' && opt !== null) {
                    return { value: opt.value, label: opt.label || String(opt.value) };
                }
                return { value: opt, label: String(opt) };
            });
        });

        const filteredOptions = computed(() => {
            if (!props.searchable || !searchText.value) return normalizedOptions.value;
            const q = searchText.value.toLowerCase();
            return normalizedOptions.value.filter(o => o.label.toLowerCase().includes(q));
        });

        const selectedLabel = computed(() => {
            const found = normalizedOptions.value.find(o => o.value === props.modelValue);
            return found ? found.label : (props.placeholder || '');
        });

        const hasValue = computed(() => {
            return props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined;
        });

        const updatePosition = () => {
            if (!triggerRef.value || !isOpen.value) return;
            const rect = triggerRef.value.getBoundingClientRect();
            const viewportH = window.innerHeight;
            const spaceBelow = viewportH - rect.bottom;
            const spaceAbove = rect.top;
            const estimatedDropdownH = Math.min(280, filteredOptions.value.length * 38 + (props.searchable ? 50 : 0) + 16);

            let top, placement;

            if (spaceBelow >= estimatedDropdownH || spaceBelow >= spaceAbove) {
                top = rect.bottom + 4;
                placement = 'bottom';
            } else {
                top = rect.top - estimatedDropdownH - 4;
                placement = 'top';
            }

            dropdownStyle.value = {
                position: 'fixed',
                left: rect.left + 'px',
                top: top + 'px',
                width: rect.width + 'px',
                zIndex: 9998,
                '--placement': placement
            };
        };

        const toggle = () => {
            if (props.disabled) return;
            isOpen.value = !isOpen.value;
            if (isOpen.value) {
                searchText.value = '';
                highlightIndex.value = -1;
                nextTick(() => {
                    updatePosition();
                    if (props.searchable && searchInputRef.value) {
                        searchInputRef.value.focus();
                    }
                    scrollToSelected();
                });
            }
        };

        const close = () => {
            isOpen.value = false;
            searchText.value = '';
            highlightIndex.value = -1;
        };

        const selectOption = (opt) => {
            emit('update:modelValue', opt.value);
            emit('change', opt.value);
            close();
        };

        const scrollToSelected = () => {
            nextTick(() => {
                if (!dropdownRef.value) return;
                const selected = dropdownRef.value.querySelector('.custom-select-option.active');
                if (selected) {
                    selected.scrollIntoView({ block: 'nearest' });
                }
            });
        };

        const handleKeydown = (e) => {
            if (!isOpen.value) {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    toggle();
                }
                return;
            }

            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    close();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (highlightIndex.value < filteredOptions.value.length - 1) {
                        highlightIndex.value++;
                        scrollToHighlight();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (highlightIndex.value > 0) {
                        highlightIndex.value--;
                        scrollToHighlight();
                    }
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (highlightIndex.value >= 0 && highlightIndex.value < filteredOptions.value.length) {
                        selectOption(filteredOptions.value[highlightIndex.value]);
                    }
                    break;
            }
        };

        const scrollToHighlight = () => {
            nextTick(() => {
                if (!dropdownRef.value) return;
                const highlighted = dropdownRef.value.querySelector('.custom-select-option.highlighted');
                if (highlighted) {
                    highlighted.scrollIntoView({ block: 'nearest' });
                }
            });
        };

        const onClickOutside = (e) => {
            if (!isOpen.value) return;
            const el = triggerRef.value;
            const dd = dropdownRef.value;
            if (el && el.contains(e.target)) return;
            if (dd && dd.contains(e.target)) return;
            close();
        };

        const onScroll = () => {
            if (isOpen.value) updatePosition();
        };

        const onResize = () => {
            if (isOpen.value) updatePosition();
        };

        onMounted(() => {
            document.addEventListener('click', onClickOutside, true);
            window.addEventListener('scroll', onScroll, true);
            window.addEventListener('resize', onResize);
        });

        onBeforeUnmount(() => {
            document.removeEventListener('click', onClickOutside, true);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        });

        return {
            isOpen,
            searchText,
            triggerRef,
            dropdownRef,
            searchInputRef,
            highlightIndex,
            dropdownStyle,
            filteredOptions,
            selectedLabel,
            hasValue,
            toggle,
            close,
            selectOption,
            handleKeydown
        };
    },
    template: `
    <div class="custom-select" :class="{ 'is-open': isOpen, 'is-disabled': disabled, ['custom-select-' + size]: size }" :style="width ? { width } : {}" ref="triggerRef" @keydown="handleKeydown" tabindex="0">
        <div class="custom-select-trigger" @click="toggle" :class="{ 'has-value': hasValue }">
            <span class="custom-select-value" v-if="hasValue">{{ selectedLabel }}</span>
            <span class="custom-select-placeholder" v-else>{{ placeholder }}</span>
            <span class="custom-select-arrow" :class="{ 'is-open': isOpen }">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 8.825a.5.5 0 01-.354-.146l-3.5-3.5a.5.5 0 11.708-.708L6 7.618l3.146-3.147a.5.5 0 11.708.708l-3.5 3.5A.5.5 0 016 8.825z" fill="currentColor"/>
                </svg>
            </span>
        </div>
    </div>
    <Teleport to="body">
        <Transition name="custom-select-dropdown">
            <div v-if="isOpen" class="custom-select-dropdown" :style="dropdownStyle" ref="dropdownRef">
                <div v-if="searchable" class="custom-select-search">
                    <input type="text" ref="searchInputRef" v-model="searchText" class="custom-select-search-input" @keydown="handleKeydown" />
                    <svg class="custom-select-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                </div>
                <div class="custom-select-options">
                    <div
                        v-for="(opt, idx) in filteredOptions"
                        :key="opt.value"
                        class="custom-select-option"
                        :class="{ 'active': opt.value === modelValue, 'highlighted': idx === highlightIndex }"
                        @click="selectOption(opt)"
                        @mouseenter="highlightIndex = idx"
                    >
                        <span class="custom-select-option-label">{{ opt.label }}</span>
                        <svg v-if="opt.value === modelValue" class="custom-select-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </div>
                    <div v-if="filteredOptions.length === 0" class="custom-select-empty">
                        <span>No results</span>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
    `
};
