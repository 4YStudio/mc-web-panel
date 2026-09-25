import { ref, reactive, computed, watch, onMounted, onUnmounted, getCurrentInstance, nextTick } from '/js/vue.esm-browser.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, openModal, t, uploadFileWithChunk, isLargeFile } from '../utils.js';

export default {
    template: `
    <div class="h-100 d-flex flex-column">
        <Transition name="fade" mode="out-in">
            <!-- 1. 文件列表视图 -->
            <div v-if="!editingFile && !previewingFile" class="d-flex flex-column h-100" key="list"
                @dragenter.prevent="dragCounter++; isDragging = true" @dragleave.prevent="dragCounter--; if (dragCounter <= 0) { isDragging = false; dragCounter = 0; }" @dragover.prevent @drop.prevent="dragCounter = 0; isDragging = false; handleDrop($event)">
                <!-- 页面标题 -->
                <div class="page-header d-flex justify-content-between align-items-center">
                    <h3 class="m-0 fw-bold"><i class="fa-solid fa-folder-open me-2 text-primary"></i>{{ $t('sidebar.files') }}</h3>
                </div>

                <!-- 顶部导航栏 -->
                <div class="row g-2 align-items-center mb-2">
                    <div class="col-12 col-md-auto flex-grow-1 overflow-hidden">
                        <nav aria-label="breadcrumb">
                            <ol class="breadcrumb mb-0 p-2 rounded-3 flex-nowrap overflow-auto no-scrollbar file-breadcrumb-bar" style="font-size: 0.9rem; background-color: var(--c-surface) !important; border: 1px solid rgba(255,255,255,0.1); min-height: 38px; display: flex; flex-direction: row; align-items: center;">
                                <li class="breadcrumb-item text-primary cursor-pointer breadcrumb-nav-item" @click="changeDir('')">
                                    <i class="fa-solid fa-house"></i>
                                </li>
                                <li v-for="(p, idx) in pathParts" :key="idx" 
                                    class="breadcrumb-item text-truncate cursor-pointer breadcrumb-nav-item" 
                                    style="max-width: 120px;"
                                    @click="changeDir(pathParts.slice(0, idx+1).join('/'))">
                                    {{ p }}
                                </li>
                            </ol>
                        </nav>
                    </div>
                    <div class="col-12 col-md-auto">
                        <div class="file-search-container d-flex align-items-center px-2.5 rounded-3 border" 
                             style="background-color: var(--c-surface); border-color: rgba(255,255,255,0.1) !important; min-height: 45px; min-width: 200px;padding: 0 10px">
                            <i class="fa-solid fa-magnifying-glass text-muted me-2" style="font-size: 0.8rem;"></i>
                            <input type="text" 
                                   class="file-search-input bg-transparent border-0 p-0 text-body flex-grow-1" 
                                   style="outline: none; font-size: 0.85rem; box-shadow: none;" 
                                   v-model="searchQuery" 
                                   :placeholder="$t('common.search') + '...'">
                            <button v-if="searchQuery" 
                                    type="button"
                                    class="btn btn-link btn-xs text-muted p-0 ms-1 border-0" 
                                    @click="searchQuery = ''" 
                                    style="text-decoration: none;">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 操作工具栏 -->
                <div class="card mb-3 bg-body-tertiary border-secondary flex-shrink-0">
                    <div class="card-body p-2 d-flex flex-wrap gap-2 align-items-center">
                        <div class="btn-group">
                            <button v-if="currentPath !== ''" class="btn btn-sm btn-outline-secondary file-action-btn" @click="goUp()" :title="$t('files.go_up')"><i class="fa-solid fa-turn-up"></i></button>
                            <button class="btn btn-sm btn-outline-secondary file-action-btn" @click="refreshFiles" :title="$t('common.refresh')"><i class="fa-solid fa-rotate" :class="{'fa-spin': isLoadingFiles}"></i></button>
                            <button class="btn btn-sm btn-outline-secondary file-action-btn" @click="askCompress" :disabled="!selectedFiles.length" :title="$t('files.compress')"><i class="fa-solid fa-file-zipper"></i></button>
                            <button class="btn btn-sm btn-outline-secondary file-action-btn" @click="extractSelected" :disabled="!selectedArchiveFiles.length" :title="$t('files.extract')"><i class="fa-solid fa-box-open"></i></button>
                            <button class="btn btn-sm btn-outline-danger file-action-btn" @click="askDelete(selectedFiles)" :disabled="!selectedFiles.length" :title="$t('common.delete')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary file-action-btn" @click="copyToClipboard('copy')" :disabled="!selectedFiles.length" :title="$t('files.copy')"><i class="fa-solid fa-copy"></i></button>
                            <button class="btn btn-sm btn-outline-primary file-action-btn" @click="copyToClipboard('move')" :disabled="!selectedFiles.length" :title="$t('files.move')"><i class="fa-solid fa-scissors"></i></button>
                            <button v-if="clipboard.files.length" class="btn btn-sm btn-warning file-action-btn" @click="pasteFiles"><i class="fa-solid fa-paste"></i> ({{ clipboard.files.length }})</button>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary file-action-btn" @click="$refs.fileUp.click()" :title="$t('files.upload_file')"><i class="fa-solid fa-file-upload"></i></button>
                            <button class="btn btn-sm btn-outline-primary file-action-btn" @click="$refs.folderUp.click()" :title="$t('files.upload_folder')"><i class="fa-solid fa-upload"></i></button>
                            <button class="btn btn-sm btn-outline-success file-action-btn" @click="askNewFile" :title="$t('files.new_file')"><i class="fa-solid fa-file-circle-plus"></i></button>
                            <button class="btn btn-sm btn-outline-success file-action-btn" @click="askNewFolder" :title="$t('files.new_folder')"><i class="fa-solid fa-folder-plus"></i></button>
                        </div>
                        <input type="file" ref="fileUp" multiple class="d-none" @change="(e)=>uploadFiles(e)">
                        <input type="file" ref="folderUp" webkitdirectory multiple class="d-none" @change="(e)=>uploadFiles(e)">
                        <div class="ms-auto d-flex gap-2">
                        </div>
                    </div>
                </div>

                <!-- 文件列表表格 -->
                <div class="card flex-grow-1 overflow-hidden position-relative" style="border-radius: 12px;">
                    <!-- 拖拽上传遮罩 -->
                    <div v-if="isDragging" class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="z-index: 10; background: rgba(var(--bs-primary-rgb), 0.15); backdrop-filter: blur(2px); border-radius: 12px; border: 3px dashed var(--bs-primary);">
                        <div class="text-center text-primary">
                            <i class="fa-solid fa-cloud-arrow-up fa-3x mb-2"></i>
                            <h5 class="fw-bold">{{ $t('files.drop_to_upload') }}</h5>
                        </div>
                    </div>
                    
                    <!-- 文件夹跳转与文件加载动画遮罩 -->
                    <Transition name="fade">
                        <div v-if="isLoadingFiles" class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center file-nav-loading-overlay" style="z-index: 8; background: rgba(var(--c-surface-rgb), 0.35); backdrop-filter: blur(2px); pointer-events: none;">
                            <div class="file-loading-capsule d-flex align-items-center gap-2 px-3 py-2 rounded-pill shadow-sm">
                                <div class="spinner-border text-primary spinner-border-sm" role="status" style="width: 1rem; height: 1rem; border-width: 2px;"></div>
                                <span class="small fw-semibold" style="color: var(--c-text-primary);">{{ $t('common.loading') }}...</span>
                            </div>
                        </div>
                    </Transition>
                    
                    <div class="table-responsive h-100 custom-scrollbar">
                        <table class="table table-hover table-sm mb-0 align-middle" style="table-layout: fixed; width: 100%;">
                            <thead>
                                <tr class="small text-uppercase text-muted">
                                    <th style="width: 38px;" class="px-2 px-md-3"><input type="checkbox" v-model="selectAll" class="form-check-input"></th>
                                    <th>{{ $t('common.name') }}</th>
                                    <th style="width: 80px;" class="d-none d-sm-table-cell">{{ $t('common.size') }}</th>
                                    <th class="d-none d-md-table-cell file-col-time" style="width: 175px;">{{ $t('common.time') }}</th>
                                    <th class="text-end px-2 px-md-3 file-col-actions">
                                        <span class="d-none d-md-inline">{{ $t('common.actions') }}</span>
                                    </th>
                                </tr>
                            </thead>
                            <TransitionGroup tag="tbody" name="list" class="file-table-body" :class="{ 'file-nav-navigating': isNavigating }">
                                <tr v-for="f in filteredFiles" :key="f.name" class="file-row" :class="{selected: selectedFiles.includes(f.name)}">
                                    <td @click.stop class="px-2 px-md-3"><input type="checkbox" :value="f.name" v-model="selectedFiles" class="form-check-input"></td>
                                    
                                    <!-- 点击名称：文件夹进入，图片预览，压缩包预览，其他文件编辑 -->
                                    <td @click="f.isDir ? changeDir(joinPath(currentPath, f.name)) : isImageFile(f.name) ? previewImage(f.name) : isArchive(f.name) ? previewArchive(f.name) : editFile(f.name)" class="py-2 pe-1 cursor-pointer overflow-hidden text-truncate file-name-cell">
                                        <div class="d-flex align-items-center min-w-0">
                                            <i class="fa-solid me-2 flex-shrink-0 file-icon" :class="getIcon(f)" style="width: 1.2rem; text-align: center;"></i>
                                            <span class="text-truncate flex-grow-1" style="min-width: 0;">{{ f.name }}</span>
                                        </div>
                                    </td>
                                    
                                    <td class="d-none d-sm-table-cell small">{{ f.isDir ? '-' : formatSize(f.size) }}</td>
                                    <td class="small text-muted d-none d-md-table-cell text-nowrap">{{ new Date(f.mtime).toLocaleString() }}</td>
                                    
                                    <td class="text-end px-2 px-md-3 py-2 file-actions-cell">
                                        <!-- Desktop actions -->
                                        <div class="d-none d-md-flex justify-content-end gap-1 flex-nowrap align-items-center">
                                            <button v-if="isArchive(f.name)" class="btn btn-xs btn-link text-warning p-1" @click.stop="extractFile(f.name)" :title="$t('files.extract')">
                                                <i class="fa-solid fa-file-zipper"></i>
                                            </button>
                                            <button v-if="!f.isDir" class="btn btn-xs btn-link text-info p-1" @click.stop="editFile(f.name)" :title="$t('common.edit')">
                                                <i class="fa-solid fa-file-pen"></i>
                                            </button>
                                            <button class="btn btn-xs btn-link text-primary p-1" @click.stop="askRename(f)" :title="$t('common.rename')">
                                                <i class="fa-solid fa-pen"></i>
                                            </button>
                                            <button v-if="!f.isDir" class="btn btn-xs btn-link text-secondary p-1" @click.stop="downloadFile(f.name)" :title="$t('common.download')">
                                                <i class="fa-solid fa-download"></i>
                                            </button>
                                            <button class="btn btn-xs btn-link text-danger p-1" @click.stop="askDelete([f.name])" :title="$t('common.delete')">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                        <!-- Mobile actions dropdown -->
                                        <div class="d-md-none dropdown file-action-dropdown-wrapper">
                                            <button class="btn btn-link btn-xs text-secondary p-1 file-more-btn" type="button" @click.stop="toggleActionMenu(f.name)">
                                                <i class="fa-solid fa-ellipsis-vertical"></i>
                                            </button>
                                            <Transition name="scale">
                                                <ul v-if="activeActionMenu === f.name" class="dropdown-menu dropdown-menu-end shadow border-0 p-1 d-block" style="border-radius: 12px; z-index: 1060; min-width: 120px; position: absolute; right: 0;">
                                                    <li v-if="isArchive(f.name)"><button class="dropdown-item rounded-3 py-1 fw-bold small" @click.stop="extractFile(f.name); activeActionMenu=null"><i class="fa-solid fa-file-zipper me-2 text-warning"></i>{{ $t('files.extract') }}</button></li>
                                                    <li v-if="!f.isDir"><button class="dropdown-item rounded-3 py-1 fw-bold small" @click.stop="editFile(f.name); activeActionMenu=null"><i class="fa-solid fa-file-pen me-2 text-info"></i>{{ $t('common.edit') }}</button></li>
                                                    <li><button class="dropdown-item rounded-3 py-1 fw-bold small" @click.stop="askRename(f); activeActionMenu=null"><i class="fa-solid fa-pen me-2 text-primary"></i>{{ $t('common.rename') }}</button></li>
                                                    <li v-if="!f.isDir"><button class="dropdown-item rounded-3 py-1 fw-bold small" @click.stop="downloadFile(f.name); activeActionMenu=null"><i class="fa-solid fa-download me-2 text-secondary"></i>{{ $t('common.download') }}</button></li>
                                                    <li><hr class="dropdown-divider opacity-10 my-1"></li>
                                                    <li><button class="dropdown-item rounded-3 py-1 text-danger fw-bold small" @click.stop="askDelete([f.name]); activeActionMenu=null"><i class="fa-solid fa-trash me-2"></i>{{ $t('common.delete') }}</button></li>
                                                </ul>
                                            </Transition>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-if="filteredFiles.length === 0" key="empty">
                                    <td colspan="5" class="text-center text-muted py-5">
                                        <i class="fa-solid fa-folder-open fa-2x mb-2 opacity-25 d-block"></i>
                                        {{ $t('files.total', {count: 0}) }}
                                    </td>
                                </tr>
                            </TransitionGroup>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- 2. 编辑器视图 (全功能增强与移动端适配) -->
            <div v-else-if="editingFile" 
                 class="d-flex flex-column h-100 advanced-editor-container overflow-hidden" 
                 :class="{ 'is-fullscreen': editorFullscreen }" 
                 key="editor">
                 
                <!-- 工具栏 Header -->
                <div class="editor-toolbar d-flex justify-content-between align-items-center py-2 px-3 flex-wrap gap-2">
                    <!-- 左侧：文件信息与未保存标识 -->
                    <div class="d-flex align-items-center overflow-hidden gap-2">
                        <i class="fa-solid fa-file-code text-primary fs-5 flex-shrink-0"></i>
                        <span class="fw-bold text-truncate" style="max-width: 160px; md-max-width: 320px;" :title="editingFile">
                            {{ editingFile.split('/').pop() }}
                        </span>
                        <span class="badge rounded-pill bg-warning-subtle text-warning border border-warning-subtle small px-2 py-0.5" v-if="hasUnsavedChanges">
                            <i class="fa-solid fa-circle-dot me-1" style="font-size: 0.6rem;"></i>{{ $t('files.editor.unsaved') }}
                        </span>
                        <span class="badge rounded-pill bg-success-subtle text-success border border-success-subtle small px-2 py-0.5 d-none d-sm-inline" v-else>
                            <i class="fa-solid fa-check me-1" style="font-size: 0.6rem;"></i>{{ $t('files.editor.saved') }}
                        </span>
                    </div>

                    <!-- 右侧：功能按钮群 -->
                    <div class="d-flex align-items-center gap-1 gap-sm-2 ms-auto flex-wrap">
                        <!-- 搜索与替换按钮 -->
                        <button class="btn btn-sm btn-outline-secondary border-0 rounded-3 px-2" 
                                :class="{ 'btn-primary text-white': editorSearchVisible }"
                                @click="toggleSearch" 
                                :title="$t('files.editor.search_tip')">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <span class="d-none d-lg-inline ms-1">{{ $t('files.editor.search') }}</span>
                        </button>

                        <!-- 代码/JSON 格式化 -->
                        <button class="btn btn-sm btn-outline-secondary border-0 rounded-3 px-2" 
                                @click="formatContent" 
                                :title="$t('files.editor.format_tip')">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                            <span class="d-none d-lg-inline ms-1">{{ $t('files.editor.format') }}</span>
                        </button>

                        <!-- 跳转指定行 -->
                        <button class="btn btn-sm btn-outline-secondary border-0 rounded-3 px-2" 
                                @click="goToLinePrompt" 
                                :title="$t('files.editor.goto_tip')">
                            <i class="fa-solid fa-arrow-down-9-1"></i>
                            <span class="d-none d-lg-inline ms-1">{{ $t('files.editor.goto_line') }}</span>
                        </button>

                        <!-- 自动折行切换 -->
                        <button class="btn btn-sm btn-outline-secondary border-0 rounded-3 px-2" 
                                :class="{ 'text-primary fw-bold': editorWrap }"
                                @click="editorWrap = !editorWrap" 
                                :title="$t('files.editor.wrap_tip')">
                            <i class="fa-solid fa-arrow-turn-down"></i>
                            <span class="d-none d-xl-inline ms-1">{{ editorWrap ? $t('files.editor.wrap_on') : $t('files.editor.wrap_off') }}</span>
                        </button>

                        <!-- 字号调节 (支持直接输入数字) -->
                        <div class="d-flex align-items-center bg-body-tertiary border rounded-3 px-1.5 py-0.5 gap-1" :title="$t('files.editor.font_size_tip')">
                            <i class="fa-solid fa-font text-muted small" style="font-size: 0.75rem;"></i>
                            <input type="number" 
                                   min="10" 
                                   max="40" 
                                   step="1"
                                   v-model.number="editorFontSize" 
                                   @input="onFontSizeInput"
                                   @change="validateFontSize"
                                   class="form-control form-control-sm border-0 p-0 text-center bg-transparent fw-bold" 
                                   style="width: 36px; font-size: 0.8rem; box-shadow: none;" />
                            <span class="text-muted small" style="font-size: 0.7rem;">px</span>
                        </div>

                        <!-- 全屏切换 -->
                        <button class="btn btn-sm btn-outline-secondary border-0 rounded-3 px-2" 
                                @click="editorFullscreen = !editorFullscreen" 
                                :title="editorFullscreen ? $t('files.editor.exit_fullscreen') : $t('files.editor.fullscreen')">
                            <i :class="editorFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'"></i>
                        </button>

                        <div class="vr mx-1"></div>

                        <!-- 保存 -->
                        <button class="btn btn-sm btn-success rounded-3 px-2 px-md-3 shadow-sm fw-semibold" @click="saveFile">
                            <i class="fa-solid fa-floppy-disk me-1"></i><span>{{ $t('common.save') }}</span>
                        </button>

                        <!-- 关闭 -->
                        <button class="btn btn-sm btn-secondary rounded-3 px-2 px-md-3 shadow-sm fw-semibold" @click="closeEditor">
                            <i class="fa-solid fa-xmark me-1"></i><span>{{ $t('common.close') }}</span>
                        </button>
                    </div>
                </div>

                <!-- 搜索与替换折叠抽屉 -->
                <div v-if="editorSearchVisible" class="editor-search-panel px-3 py-2 border-bottom shadow-sm">
                    <!-- 第一行：搜索 -->
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <div class="input-group input-group-sm flex-nowrap" style="max-width: 320px;">
                            <span class="input-group-text bg-body border-end-0"><i class="fa-solid fa-magnifying-glass text-muted"></i></span>
                            <input type="text" 
                                   ref="searchInputEl"
                                   class="form-control border-start-0 px-1" 
                                   v-model="editorSearchQuery" 
                                   @input="onSearchInput(false)"
                                   @keydown.enter.prevent="findNext"
                                   @keydown.esc.prevent="closeSearch"
                                   :placeholder="$t('files.editor.search_placeholder')">
                            <button class="btn btn-outline-secondary" @click="findNext" :disabled="!editorSearchQuery" :title="$t('files.editor.find_next')">
                                <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>

                        <!-- 匹配结果指示 -->
                        <span class="small text-muted font-monospace" style="font-size: 0.78rem; min-width: 50px;">
                            {{ searchMatches.length ? (currentMatchIndex + 1) + ' / ' + searchMatches.length : (editorSearchQuery ? $t('files.editor.no_match') : '') }}
                        </span>

                        <!-- 上一个 / 下一个 -->
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary" @click="findPrev" :disabled="!searchMatches.length" :title="$t('files.editor.find_prev')">
                                <i class="fa-solid fa-chevron-up"></i>
                            </button>
                            <button class="btn btn-outline-secondary" @click="findNext" :disabled="!searchMatches.length" :title="$t('files.editor.find_next')">
                                <i class="fa-solid fa-chevron-down"></i>
                            </button>
                        </div>

                        <!-- 大小写敏感 / 全词匹配 -->
                        <button class="btn btn-sm btn-outline-secondary px-2 font-monospace fw-bold" 
                                :class="{ 'btn-primary text-white': searchMatchCase }"
                                @click="searchMatchCase = !searchMatchCase; onSearchInput();" 
                                title="Match Case (大小写敏感)">
                            Aa
                        </button>
                        <button class="btn btn-sm btn-outline-secondary px-2 font-monospace fw-bold" 
                                :class="{ 'btn-primary text-white': searchMatchWord }"
                                @click="searchMatchWord = !searchMatchWord; onSearchInput();" 
                                title="Match Whole Word (全词匹配)">
                            \\b
                        </button>

                        <!-- 展开/收起替换条 -->
                        <button class="btn btn-sm btn-link text-decoration-none text-muted px-1" 
                                @click="editorReplaceVisible = !editorReplaceVisible">
                            <i :class="editorReplaceVisible ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'"></i>
                            <span class="small ms-1">{{ $t('files.editor.replace') }}</span>
                        </button>

                        <!-- 关闭搜索框 -->
                        <button class="btn btn-sm btn-outline-secondary border-0 ms-auto" @click="closeSearch">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <!-- 第二行：替换条 -->
                    <div v-if="editorReplaceVisible" class="d-flex align-items-center gap-2 mt-2 flex-wrap">
                        <div class="input-group input-group-sm flex-nowrap" style="max-width: 300px;">
                            <span class="input-group-text bg-body border-end-0"><i class="fa-solid fa-arrows-rotate text-muted"></i></span>
                            <input type="text" 
                                   class="form-control border-start-0 px-1" 
                                   v-model="editorReplaceQuery" 
                                   @keydown.enter.prevent="replaceCurrent"
                                   @keydown.esc.prevent="closeSearch"
                                   :placeholder="$t('files.editor.replace_placeholder')">
                        </div>

                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-secondary px-2" @click="replaceCurrent" :disabled="!searchMatches.length">
                                {{ $t('files.editor.replace') }}
                            </button>
                            <button class="btn btn-sm btn-outline-secondary px-2" @click="replaceAll" :disabled="!searchMatches.length">
                                {{ $t('files.editor.replace_all') }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 核心编辑区：行号栏 + 文本区域 -->
                <div class="editor-body flex-grow-1 d-flex overflow-hidden position-relative" style="min-height: 200px;">
                    <!-- 左侧行号栏 -->
                    <div ref="gutterArea" class="editor-gutter flex-shrink-0" :style="{ fontSize: editorFontSize + 'px' }">
                        <div v-for="line in editorLineCount" :key="line" class="editor-gutter-line" @click="goToLine(line)">
                            {{ line }}
                        </div>
                    </div>

                    <!-- 文本输入框 -->
                    <textarea 
                        ref="editorArea"
                        class="form-control editor-textarea flex-grow-1 custom-scrollbar" 
                        :style="{ 
                            fontSize: editorFontSize + 'px', 
                            whiteSpace: editorWrap ? 'pre-wrap' : 'pre',
                            wordBreak: editorWrap ? 'break-all' : 'normal',
                            overflowX: editorWrap ? 'hidden' : 'auto'
                        }" 
                        v-model="fileContent"
                        @scroll="onEditorScroll"
                        @click="updateCursorPos"
                        @keyup="updateCursorPos"
                        @select="updateCursorPos"
                        @keydown="handleEditorKeyDown"
                        spellcheck="false"
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="off"
                    ></textarea>
                </div>

                <!-- 移动端编程快捷辅助符号键盘条 -->
                <div class="editor-mobile-symbols py-1 px-2 d-flex align-items-center gap-1 shadow-sm">
                    <button v-for="sym in mobileSymbols" 
                            :key="sym" 
                            type="button" 
                            class="editor-symbol-btn flex-shrink-0" 
                            @click="insertSymbol(sym)"
                            :title="sym === 'Tab' ? 'Insert 2 spaces' : sym">
                        {{ sym }}
                    </button>
                </div>

                <!-- 底部状态栏 -->
                <div class="editor-status-bar d-flex justify-content-between align-items-center px-3 py-1">
                    <div class="d-flex align-items-center gap-3">
                        <span>Ln {{ cursorLine }}, Col {{ cursorCol }}</span>
                        <span class="d-none d-sm-inline">{{ $t('files.editor.lines') }}: {{ editorLineCount }}</span>
                        <span class="d-none d-md-inline">{{ $t('files.editor.length') }}: {{ fileContent.length }}</span>
                    </div>
                    <div class="d-flex align-items-center gap-3">
                        <span class="d-none d-sm-inline">UTF-8</span>
                        <span>{{ fileContent.includes('\\r\\n') ? 'CRLF' : 'LF' }}</span>
                        <span v-if="hasUnsavedChanges" class="text-warning fw-semibold"><i class="fa-solid fa-pen me-1"></i>{{ $t('files.editor.modified') }}</span>
                        <span v-else class="text-success"><i class="fa-solid fa-check me-1"></i>{{ $t('files.editor.saved') }}</span>
                    </div>
                </div>
            </div>

            <!-- 3. 预览视图 -->
            <div v-else-if="previewingFile" class="d-flex flex-column h-100" key="preview">
                <div class="card h-100 d-flex flex-column" style="border-radius: 12px; overflow: hidden;">
                    <div class="card-header bg-body-tertiary d-flex justify-content-between align-items-center py-2 px-3">
                        <div class="d-flex align-items-center overflow-hidden">
                            <i class="fa-solid me-2 flex-shrink-0" :class="previewType === 'image' ? 'fa-file-image text-primary' : 'fa-file-zipper text-danger'"></i>
                            <span class="fw-bold text-truncate" style="max-width: 300px;">{{ previewingFile.split('/').pop() }}</span>
                        </div>
                        <div class="d-flex gap-2">
                            <button v-if="previewType === 'archive'" class="btn btn-sm btn-warning px-2 px-md-3" @click="askExtract(previewingFile.split('/').pop())">
                                <i class="fa-solid fa-box-open me-md-1"></i><span class="d-none d-md-inline">{{ $t('files.extract') }}</span>
                            </button>
                            <button class="btn btn-sm btn-secondary px-2 px-md-3" @click="closePreview">
                                <i class="fa-solid fa-xmark me-md-1"></i><span class="d-none d-md-inline">{{ $t('common.close') }}</span>
                            </button>
                        </div>
                    </div>
                    <div class="flex-grow-1 overflow-auto custom-scrollbar p-3">
                        <!-- 图片预览 -->
                        <div v-if="previewType === 'image'" class="d-flex align-items-center justify-content-center h-100">
                            <img :src="previewData" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;" @error="previewData = ''">
                        </div>
                        <!-- 压缩包预览 -->
                        <div v-else-if="previewType === 'archive'">
                            <div v-if="previewData && previewData.length > 0">
                                <table class="table table-sm table-hover mb-0">
                                    <thead>
                                        <tr class="small text-uppercase text-muted">
                                            <th>{{ $t('common.name') }}</th>
                                            <th style="width: 80px;">{{ $t('common.size') }}</th>
                                            <th style="width: 80px;" class="d-none d-sm-table-cell">{{ $t('files.compress') }}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="entry in previewData" :key="entry.name">
                                            <td class="text-truncate" style="max-width: 400px;">
                                                <i class="fa-solid me-1" :class="entry.isDir ? 'fa-folder text-warning' : 'fa-file text-muted'" style="width: 1rem;"></i>
                                                {{ entry.name }}
                                            </td>
                                            <td class="small">{{ entry.isDir ? '-' : formatSize(entry.size) }}</td>
                                            <td class="small d-none d-sm-table-cell">{{ entry.isDir ? '-' : formatSize(entry.compressedSize) }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div v-else class="text-center text-muted py-5">
                                <i class="fa-solid fa-spinner fa-spin fa-2x mb-2 d-block"></i>
                                {{ $t('common.loading') }}...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Upload Confirmation Modal in FileManager -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="uploadConfirmModal.visible" class="modal-backdrop fade show" style="z-index: 2060; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);"></div>
            </Transition>

            <Transition name="scale">
                <div v-if="uploadConfirmModal.visible" class="modal show d-block" @click.self="uploadConfirmModal.visible = false" style="z-index: 2070;">
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content shadow-lg border-0 rounded-4 overflow-hidden" style="background: var(--c-surface); color: var(--c-text-primary); border: 1px solid var(--c-border);">
                            <div class="modal-header border-0 bg-primary text-white py-3 shadow-sm">
                                <h5 class="modal-title fw-bold">
                                    <i class="fa-solid fa-cloud-arrow-up me-2 text-warning"></i>{{ $t('files.upload_confirm_title') }}
                                </h5>
                                <button type="button" class="btn-close btn-close-white" @click="uploadConfirmModal.visible = false"></button>
                            </div>
                            
                            <div class="modal-body p-4" style="background: var(--c-surface); color: var(--c-text-primary);">
                                <p class="small mb-3" style="color: var(--c-text-secondary);">
                                    {{ $t('files.upload_confirm_desc') }}
                                </p>
                                
                                <div class="card border rounded-3 overflow-hidden" style="background: var(--c-surface-elevated, bg-body-tertiary); border-color: var(--c-border) !important;">
                                    <div class="card-header bg-primary bg-opacity-10 fw-bold d-flex justify-content-between align-items-center py-2 px-3 border-0" style="color: var(--c-primary);">
                                        <span><i class="fa-solid fa-list me-2"></i>{{ $t('files.upload_list_title') }}</span>
                                        <span class="badge bg-primary bg-opacity-20 rounded-pill small" style="color: var(--c-primary);">{{ checkedCount }} / {{ uploadConfirmModal.files.length }}</span>
                                    </div>
                                    <div class="card-body p-2 overflow-auto custom-scrollbar" style="max-height: 350px;">
                                        <div class="list-group list-group-flush">
                                            <label v-for="(item, idx) in uploadConfirmModal.files" :key="idx" class="list-group-item bg-transparent border-0 d-flex align-items-start gap-2 py-1.5 px-2 cursor-pointer">
                                                <input class="form-check-input flex-shrink-0 mt-1" type="checkbox" v-model="item.selected">
                                                <div class="min-width-0">
                                                    <div class="text-truncate fw-semibold small" style="color: var(--c-text-primary);" :title="item.relativePath">{{ item.relativePath }}</div>
                                                    <div class="font-monospace" style="font-size: 0.65rem; color: var(--c-text-secondary);">{{ formatSize(item.file.size) }}</div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="modal-footer border-0 px-4 py-3 d-flex justify-content-end gap-2" style="background: var(--c-surface-elevated, var(--c-surface)); border-top: 1px solid var(--c-border) !important;">
                                <button type="button" class="btn btn-secondary px-3 py-1.5 rounded-pill shadow-sm fw-bold small" @click="uploadConfirmModal.visible = false">{{ $t('common.cancel') }}</button>
                                <button type="button" class="btn btn-primary px-3 py-1.5 rounded-pill shadow-sm fw-bold small" @click="confirmUploadFromModal" :disabled="!hasAnySelectedFiles">{{ $t('common.confirm') }}{{ $t('common.upload') }}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
    `,
    setup() {
        // ... (existing setup code) ...
        const currentPath = ref('');
        const fileList = ref([]);
        const selectedFiles = ref([]);
        const selectAll = ref(false);
        const searchQuery = ref('');
        const activeActionMenu = ref(null);
        const { proxy } = getCurrentInstance();
        const $t = proxy.$t;
        const editingFile = ref(null);
        const fileContent = ref('');
        const originalContent = ref('');
        const editorArea = ref(null);
        const clipboard = ref({ action: '', files: [], sourcePath: '' });
        const fileUp = ref(null);
        const folderUp = ref(null);
        const isDragging = ref(false);
        const dragCounter = ref(0);
        const previewingFile = ref(null);
        const previewType = ref('');
        const previewData = ref(null);
        const isNavigating = ref(false);
        const isLoadingFiles = ref(false);
        // Upload Confirmation Modal state
        const uploadConfirmModal = reactive({
            visible: false,
            files: [],
        });

        const checkedCount = computed(() => {
            return uploadConfirmModal.files.filter(f => f.selected).length;
        });

        const hasAnySelectedFiles = computed(() => {
            return uploadConfirmModal.files.some(f => f.selected);
        });

        const processFilesForUpload = (files) => {
            uploadConfirmModal.files = files.map(f => ({ file: f.file, relativePath: f.relativePath, selected: true }));
            uploadConfirmModal.visible = true;
        };

        const confirmUploadFromModal = () => {
            uploadConfirmModal.visible = false;
            const selected = uploadConfirmModal.files.filter(f => f.selected).map(f => ({ file: f.file, relativePath: f.relativePath }));
            if (selected.length) {
                executeUpload(selected);
            }
        };

        const pathParts = computed(() => currentPath.value ? currentPath.value.split('/') : []);
        const joinPath = (base, name) => base ? `${base}/${name}` : name;
        const goUp = () => { if (!currentPath.value) return; const parts = currentPath.value.split('/'); parts.pop(); changeDir(parts.join('/')); };
        
        const loadFiles = async (showLoading = true) => {
            if (showLoading) isLoadingFiles.value = true;
            try {
                const res = await api.get(`/api/files/list?path=${encodeURIComponent(currentPath.value)}`);
                fileList.value = res.data.sort((a, b) => {
                    if (a.isDir !== b.isDir) return b.isDir - a.isDir;
                    return a.name.localeCompare(b.name);
                });
                selectedFiles.value = [];
                selectAll.value = false;
            } catch (e) {
                showToast($t('common.error'), 'danger');
            } finally {
                if (showLoading && !isNavigating.value) {
                    isLoadingFiles.value = false;
                }
            }
        };

        const changeDir = async (path) => {
            if (isNavigating.value) return;
            isNavigating.value = true;
            isLoadingFiles.value = true;

            const targetPath = path;
            const fadeOutDuration = 160;
            const fadeOutTimer = new Promise(resolve => setTimeout(resolve, fadeOutDuration));
            let nextData = null;
            let fetchError = false;

            const fetchTask = api.get(`/api/files/list?path=${encodeURIComponent(targetPath)}`)
                .then(res => {
                    nextData = res.data;
                })
                .catch(e => {
                    fetchError = true;
                });

            try {
                // 等待列表平滑淡出至透明，同时异步拉取新文件夹内容
                await Promise.all([fetchTask, fadeOutTimer]);

                if (fetchError) {
                    showToast($t('common.error'), 'danger');
                } else if (nextData) {
                    currentPath.value = targetPath;
                    // 在内容完全透明期间无感更新列表项
                    fileList.value = nextData.sort((a, b) => {
                        if (a.isDir !== b.isDir) return b.isDir - a.isDir;
                        return a.name.localeCompare(b.name);
                    });
                    selectedFiles.value = [];
                    selectAll.value = false;
                }
            } finally {
                // 确保新 DOM 节点渲染后平滑淡入呈现
                setTimeout(() => {
                    isNavigating.value = false;
                    isLoadingFiles.value = false;
                }, 30);
            }
        };
        const filteredFiles = computed(() => fileList.value.filter(f => f.name.toLowerCase().includes(searchQuery.value.toLowerCase())));
        const selectedArchiveFiles = computed(() => selectedFiles.value.filter(f => isArchive(f)));
        watch(selectAll, (v) => selectedFiles.value = v ? filteredFiles.value.map(f => f.name) : []);
        const getIcon = (f) => { if (f.isDir) return 'fa-folder text-warning'; if (f.name.endsWith('.jar')) return 'fa-cube text-success'; if (/\.(json|toml|yaml|yml|conf|properties)$/.test(f.name)) return 'fa-file-code text-info'; if (/\.(log|txt|md)$/.test(f.name)) return 'fa-file-lines text-secondary'; if (/\.(zip|tar|gz)$/.test(f.name)) return 'fa-file-zipper text-danger'; if (/\.(png|jpg|jpeg|gif|webp|bmp|svg|ico)$/.test(f.name)) return 'fa-file-image text-primary'; return 'fa-file text-muted'; };
        const formatSize = (bytes) => { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]; };
        const isArchive = (name) => /\.(zip|tar\.gz|tgz|tar|gz)$/i.test(name);
        const isImageFile = (name) => /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico)$/i.test(name);
        const previewImage = (name) => {
            previewingFile.value = joinPath(currentPath.value, name);
            previewType.value = 'image';
            const params = new URLSearchParams({ path: joinPath(currentPath.value, name) });
            if (store.currentInstanceId) params.set('instanceId', store.currentInstanceId);
            previewData.value = `/api/files/preview-image?${params.toString()}`;
        };
        const previewArchive = async (name) => {
            previewingFile.value = joinPath(currentPath.value, name);
            previewType.value = 'archive';
            previewData.value = [];
            try {
                const res = await api.get(`/api/files/archive-list?path=${encodeURIComponent(joinPath(currentPath.value, name))}`);
                previewData.value = res.data.entries || [];
            } catch (e) {
                showToast($t('common.error'), 'danger');
            }
        };
        const closePreview = () => {
            previewingFile.value = null;
            previewType.value = '';
            previewData.value = null;
        };
        const askExtract = (name) => {
            const defaultDest = name.replace(/\.(zip|tar\.gz|tgz|tar|gz)$/i, '');
            openModal({
                title: $t('files.modal_extract_title'),
                message: $t('files.modal_extract_dest'),
                mode: 'input',
                inputValue: defaultDest,
                placeholder: defaultDest,
                callback: async (dest) => {
                    const destPath = dest ? joinPath(currentPath.value, dest) : joinPath(currentPath.value, defaultDest);
                    await operateFilesWithProgress('extract', [name], destPath);
                }
            });
        };
        const extractFile = (name) => askExtract(name);
        const extractSelected = () => {
            if (selectedArchiveFiles.value.length === 0) return;
            if (selectedArchiveFiles.value.length === 1) {
                askExtract(selectedArchiveFiles.value[0]);
            } else {
                selectedArchiveFiles.value.forEach(f => {
                    const defaultDest = f.replace(/\.(zip|tar\.gz|tgz|tar|gz)$/i, '');
                    operateFilesWithProgress('extract', [f], joinPath(currentPath.value, defaultDest));
                });
            }
            selectedFiles.value = selectedFiles.value.filter(f => !isArchive(f));
        };

        const handleDrop = async (e) => {
            isDragging.value = false;
            const items = e.dataTransfer.items;
            const files = [];
            if (items && items.length > 0) {
                const entries = [];
                for (let i = 0; i < items.length; i++) {
                    if (items[i].kind !== 'file') continue;
                    const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
                    if (entry) {
                        entries.push(entry);
                    } else {
                        const f = items[i].getAsFile();
                        if (f) files.push({ file: f, relativePath: f.name });
                    }
                }
                for (const entry of entries) {
                    await collectFilesFromEntry(entry, '', files);
                }
            } else {
                for (let i = 0; i < e.dataTransfer.files.length; i++) {
                    const f = e.dataTransfer.files[i];
                    files.push({ file: f, relativePath: f.webkitRelativePath || f.name });
                }
            }
            if (!files.length) return;
            await uploadDroppedFiles(files);
        };

        const collectFilesFromEntry = async (entry, basePath, files) => {
            if (entry.isFile) {
                const file = await new Promise((resolve) => entry.file(resolve));
                files.push({ file, relativePath: basePath + file.name });
            } else if (entry.isDirectory) {
                const reader = entry.createReader();
                const allEntries = [];
                await new Promise((resolve) => {
                    const readBatch = () => {
                        reader.readEntries((batch) => {
                            if (!batch.length) resolve();
                            else { allEntries.push(...batch); readBatch(); }
                        }, (err) => { console.warn('readEntries error:', err); resolve(); });
                    };
                    readBatch();
                });
                for (const e of allEntries) {
                    await collectFilesFromEntry(e, basePath + entry.name + '/', files);
                }
            }
        };

        const uploadDroppedFiles = (fileEntries) => {
            const allFiles = fileEntries.map(e => ({ file: e.file, relativePath: e.relativePath }));
            processFilesForUpload(allFiles);
        };

        // --- 文件编辑逻辑 (高级增强版与移动端适配) ---
        const EDITABLE_EXTS = ['txt', 'log', 'json', 'yml', 'yaml', 'properties', 'conf', 'toml', 'cfg', 'ini', 'sh', 'bat', 'js', 'md', 'xml'];

        const gutterArea = ref(null);
        const searchInputEl = ref(null);
        const editorSearchVisible = ref(false);
        const editorReplaceVisible = ref(false);
        const editorSearchQuery = ref('');
        const editorReplaceQuery = ref('');
        const searchMatchCase = ref(false);
        const searchMatchWord = ref(false);
        const searchMatches = ref([]);
        const currentMatchIndex = ref(-1);

        const editorWrap = ref(true);
        const editorFontSize = ref(13);
        const editorFullscreen = ref(false);
        const cursorLine = ref(1);
        const cursorCol = ref(1);

        const mobileSymbols = ['Tab', '{', '}', '[', ']', '(', ')', '"', "'", ':', ';', '=', ',', '.', '/', '\\', '_', '-', '#', '<', '>', '$', '%'];

        const editorLineCount = computed(() => {
            if (!fileContent.value) return 1;
            return fileContent.value.split('\n').length;
        });

        const updateCursorPos = () => {
            const el = editorArea.value;
            if (!el) return;
            const start = el.selectionStart || 0;
            const before = fileContent.value.substring(0, start);
            const lines = before.split('\n');
            cursorLine.value = lines.length;
            cursorCol.value = lines[lines.length - 1].length + 1;
        };

        const onEditorScroll = () => {
            if (gutterArea.value && editorArea.value) {
                gutterArea.value.scrollTop = editorArea.value.scrollTop;
            }
        };

        const onFontSizeInput = () => {
            const size = Number(editorFontSize.value);
            if (!isNaN(size) && size >= 8 && size <= 48) {
                // 即时动态调整
            }
        };

        const validateFontSize = () => {
            let size = parseInt(editorFontSize.value, 10);
            if (isNaN(size) || size < 10) size = 10;
            if (size > 40) size = 40;
            editorFontSize.value = size;
        };

        const toggleSearch = () => {
            editorSearchVisible.value = !editorSearchVisible.value;
            if (editorSearchVisible.value) {
                nextTick(() => {
                    searchInputEl.value?.focus();
                    searchInputEl.value?.select();
                    onSearchInput(false);
                });
            } else {
                searchMatches.value = [];
                currentMatchIndex.value = -1;
                editorArea.value?.focus();
            }
        };

        const closeSearch = () => {
            editorSearchVisible.value = false;
            editorReplaceVisible.value = false;
            searchMatches.value = [];
            currentMatchIndex.value = -1;
            editorArea.value?.focus();
        };

        const highlightMatch = (index) => {
            if (index < 0 || index >= searchMatches.value.length) return;
            const match = searchMatches.value[index];
            const el = editorArea.value;
            if (!el) return;
            el.focus();
            el.setSelectionRange(match.start, match.end);
            updateCursorPos();

            // 滚动到该位置附近居中
            const textBefore = fileContent.value.substring(0, match.start);
            const lineNum = textBefore.split('\n').length;
            const lineHeight = editorFontSize.value * 1.5;
            const targetScrollTop = (lineNum - 5) * lineHeight;
            el.scrollTop = Math.max(0, targetScrollTop);
        };

        const onSearchInput = (autoHighlight = false) => {
            const q = editorSearchQuery.value;
            if (!q) {
                searchMatches.value = [];
                currentMatchIndex.value = -1;
                return;
            }

            try {
                let pattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (searchMatchWord.value) pattern = `\\b${pattern}\\b`;
                const flags = searchMatchCase.value ? 'g' : 'gi';
                const regex = new RegExp(pattern, flags);
                const text = fileContent.value;
                const matches = [];
                let m;
                while ((m = regex.exec(text)) !== null) {
                    matches.push({ start: m.index, end: m.index + m[0].length });
                    if (matches.length > 2000) break;
                }
                searchMatches.value = matches;
                if (matches.length > 0) {
                    const selStart = editorArea.value?.selectionStart || 0;
                    let nearestIdx = matches.findIndex(item => item.start >= selStart);
                    if (nearestIdx === -1) nearestIdx = 0;
                    currentMatchIndex.value = nearestIdx;
                    // 仅当明确指定自动高亮时才聚焦到 textarea，输入打字时绝不抢夺焦点
                    if (autoHighlight) {
                        highlightMatch(nearestIdx);
                    }
                } else {
                    currentMatchIndex.value = -1;
                }
            } catch (e) {
                searchMatches.value = [];
                currentMatchIndex.value = -1;
            }
        };

        const findNext = () => {
            if (!searchMatches.value.length) {
                onSearchInput(true);
                return;
            }
            currentMatchIndex.value = (currentMatchIndex.value + 1) % searchMatches.value.length;
            highlightMatch(currentMatchIndex.value);
        };

        const findPrev = () => {
            if (!searchMatches.value.length) {
                onSearchInput(true);
                return;
            }
            currentMatchIndex.value = (currentMatchIndex.value - 1 + searchMatches.value.length) % searchMatches.value.length;
            highlightMatch(currentMatchIndex.value);
        };

        const replaceCurrent = () => {
            if (!searchMatches.value.length || currentMatchIndex.value < 0) return;
            const match = searchMatches.value[currentMatchIndex.value];
            const text = fileContent.value;
            const replacement = editorReplaceQuery.value || '';
            fileContent.value = text.substring(0, match.start) + replacement + text.substring(match.end);
            nextTick(() => {
                onSearchInput(false);
            });
        };

        const replaceAll = () => {
            if (!searchMatches.value.length) return;
            const count = searchMatches.value.length;
            let pattern = editorSearchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (searchMatchWord.value) pattern = `\\b${pattern}\\b`;
            const flags = searchMatchCase.value ? 'g' : 'gi';
            const regex = new RegExp(pattern, flags);
            fileContent.value = fileContent.value.replace(regex, editorReplaceQuery.value || '');
            showToast($t('files.editor.replace_count', { count }), 'success');
            nextTick(() => {
                onSearchInput(false);
            });
        };

        const formatContent = () => {
            const fileName = (editingFile.value || '').toLowerCase();
            const original = fileContent.value;
            if (!original || !original.trim()) {
                showToast('files.editor.already_formatted', 'info');
                return;
            }

            let formatted = null;
            const isJson = fileName.endsWith('.json') || fileName.endsWith('.json5') || original.trim().startsWith('{') || original.trim().startsWith('[');
            const isProperties = fileName.endsWith('.properties') || fileName.endsWith('.ini') || fileName.endsWith('.cfg') || fileName.endsWith('.conf');

            if (isJson) {
                // 1. 先尝试直接标准 JSON 解析
                try {
                    const parsed = JSON.parse(original);
                    formatted = JSON.stringify(parsed, null, 2);
                } catch (e1) {
                    // 2. 容错尝试：去除单行/多行注释、结尾逗号、单引号等
                    try {
                        const cleaned = original
                            .replace(/\/\*[\s\S]*?\*\//g, '')
                            .replace(/\/\/.*/g, '')
                            .replace(/,\s*([}\]])/g, '$1');
                        const parsed = JSON.parse(cleaned);
                        formatted = JSON.stringify(parsed, null, 2);
                    } catch (e2) {
                        showToast(t('files.editor.format_json_fail') + ' (' + e1.message + ')', 'danger');
                        return;
                    }
                }
            } else if (isProperties) {
                // Properties/INI 规范化：保留注释行，规范化 key=value，去除多余空白行
                const lines = original.split('\n');
                const outLines = [];
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmed = line.trim();
                    if (!trimmed) {
                        if (outLines.length > 0 && outLines[outLines.length - 1] !== '') {
                            outLines.push('');
                        }
                        continue;
                    }
                    if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
                        outLines.push(trimmed);
                        continue;
                    }
                    const eqIdx = line.indexOf('=');
                    const colonIdx = line.indexOf(':');
                    const sepIdx = (eqIdx !== -1) ? eqIdx : colonIdx;
                    if (sepIdx !== -1) {
                        const k = line.substring(0, sepIdx).trim();
                        const v = line.substring(sepIdx + 1).trim();
                        const sep = (eqIdx !== -1) ? '=' : ': ';
                        outLines.push(`${k}${sep}${v}`);
                    } else {
                        outLines.push(trimmed);
                    }
                }
                formatted = outLines.join('\n');
            } else {
                // 通用文本与代码美化：清理每行行末空格，压缩连续多余空行
                const lines = original.split('\n').map(l => l.trimEnd());
                const cleanLines = [];
                let consecutiveEmpty = 0;
                for (const l of lines) {
                    if (l === '') {
                        consecutiveEmpty++;
                        if (consecutiveEmpty <= 1) cleanLines.push('');
                    } else {
                        consecutiveEmpty = 0;
                        cleanLines.push(l);
                    }
                }
                formatted = cleanLines.join('\n');
            }

            if (formatted !== null) {
                if (original.includes('\r\n')) {
                    formatted = formatted.replace(/\n/g, '\r\n');
                }
                if (formatted === original) {
                    showToast('files.editor.already_formatted', 'info');
                } else {
                    fileContent.value = formatted;
                    showToast('files.editor.format_success', 'success');
                    updateCursorPos();
                }
            }
        };

        const goToLine = (targetLine) => {
            const lines = fileContent.value.split('\n');
            const l = Math.max(1, Math.min(targetLine, lines.length));
            let charIndex = 0;
            for (let i = 0; i < l - 1; i++) {
                charIndex += lines[i].length + 1;
            }
            const el = editorArea.value;
            if (el) {
                el.focus();
                el.setSelectionRange(charIndex, charIndex);
                updateCursorPos();
                const lineHeight = editorFontSize.value * 1.5;
                el.scrollTop = Math.max(0, (l - 5) * lineHeight);
            }
        };

        const goToLinePrompt = () => {
            openModal({
                title: $t('files.editor.goto_line'),
                message: $t('files.editor.goto_prompt', { max: editorLineCount.value }),
                mode: 'input',
                inputValue: cursorLine.value.toString(),
                placeholder: '1 - ' + editorLineCount.value,
                callback: (input) => {
                    if (!input) return;
                    const num = parseInt(input, 10);
                    if (!isNaN(num)) {
                        goToLine(num);
                    }
                }
            });
        };

        const insertSymbol = (sym) => {
            const el = editorArea.value;
            if (!el) return;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const text = fileContent.value;
            const insertStr = (sym === 'Tab') ? '  ' : sym;
            fileContent.value = text.substring(0, start) + insertStr + text.substring(end);
            nextTick(() => {
                el.focus();
                const newPos = start + insertStr.length;
                el.setSelectionRange(newPos, newPos);
                updateCursorPos();
            });
        };

        const handleEditorKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                saveFile();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                editorSearchVisible.value = true;
                nextTick(() => {
                    searchInputEl.value?.focus();
                    searchInputEl.value?.select();
                    onSearchInput();
                });
                return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
                e.preventDefault();
                editorSearchVisible.value = true;
                editorReplaceVisible.value = true;
                nextTick(() => {
                    searchInputEl.value?.focus();
                    onSearchInput();
                });
                return;
            }
            if (e.key === 'Escape') {
                if (editorSearchVisible.value) {
                    closeSearch();
                    return;
                }
                if (editorFullscreen.value) {
                    editorFullscreen.value = false;
                    return;
                }
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                insertSymbol('Tab');
            }
        };

        const editFile = async (name) => {
            const ext = name.split('.').pop().toLowerCase();
            const doEdit = async () => {
                const fullPath = joinPath(currentPath.value, name);
                try {
                    const res = await api.get(`/api/files/content?path=${fullPath}`);
                    fileContent.value = res.data.content;
                    originalContent.value = res.data.content;
                    editingFile.value = fullPath;
                    cursorLine.value = 1;
                    cursorCol.value = 1;
                    editorSearchVisible.value = false;
                    editorReplaceVisible.value = false;
                    nextTick(() => {
                        editorArea.value?.focus();
                        editorArea.value?.setSelectionRange(0, 0);
                        updateCursorPos();
                    });
                } catch (e) { showToast($t('files.error_read'), 'danger'); }
            };

            if (!EDITABLE_EXTS.includes(ext) && name.includes('.')) {
                openModal({
                    title: $t('files.modal_edit_warning_title'),
                    message: $t('files.modal_edit_warning_msg', { name: name }),
                    callback: doEdit
                });
            } else {
                doEdit();
            }
        };

        const hasUnsavedChanges = computed(() => fileContent.value !== originalContent.value);

        const saveFile = async () => {
            try {
                await api.post('/api/files/save', { filepath: editingFile.value, content: fileContent.value });
                originalContent.value = fileContent.value; // 更新原始值
                showToast($t('common.success'));
            } catch (e) { showToast($t('common.error'), 'danger'); }
        };

        const doCloseEditor = () => {
            editingFile.value = null;
            fileContent.value = '';
            originalContent.value = '';
            editorFullscreen.value = false;
            editorSearchVisible.value = false;
            editorReplaceVisible.value = false;
            searchMatches.value = [];
            currentMatchIndex.value = -1;
        };

        const closeEditor = () => {
            if (hasUnsavedChanges.value) {
                openModal({
                    title: $t('common.tip') || '提示',
                    message: $t('common.unsaved_changes'),
                    callback: () => {
                        doCloseEditor();
                    }
                });
                return;
            }
            doCloseEditor();
        };

        // --- 基础文件操作 ---
        const uploadFiles = (e) => {
            const files = e.target.files;
            if (!files.length) return;
            const fileListArray = [];
            for (let i = 0; i < files.length; i++) {
                fileListArray.push({ file: files[i], relativePath: files[i].webkitRelativePath || files[i].name });
            }
            processFilesForUpload(fileListArray);
            e.target.value = '';
        };

        const executeUpload = async (filesToUpload) => {
            const totalSize = filesToUpload.reduce((s, f) => s + f.file.size, 0);
            let uploadedSize = 0;

            const controller = new AbortController();
            store.task.visible = true;
            store.task.title = $t('common.upload');
            store.task.percent = 0;
            store.task.processedSize = 0;
            store.task.totalSize = totalSize;
            store.task.fileName = '';
            store.task.speed = 0;
            store.task.canCancel = true;
            store.task.onCancel = () => {
                controller.abort();
            };

            let lastTime = Date.now();
            let lastLoaded = 0;

            const updateProgress = (loadedBytes, currentFileName) => {
                const currentUploaded = uploadedSize + loadedBytes;
                store.task.percent = Math.min(100, Math.round((currentUploaded * 100) / totalSize));
                store.task.processedSize = currentUploaded;
                store.task.fileName = currentFileName;

                const now = Date.now();
                const timeDiff = (now - lastTime) / 1000;
                if (timeDiff >= 0.5) {
                    const loadedDiff = currentUploaded - lastLoaded;
                    store.task.speed = Math.round(loadedDiff / timeDiff);
                    lastTime = now;
                    lastLoaded = currentUploaded;
                }
            };

            try {
                const smallFiles = filesToUpload.filter(e => !isLargeFile(e.file));
                const largeFiles = filesToUpload.filter(e => isLargeFile(e.file));

                if (smallFiles.length) {
                    const fd = new FormData();
                    const fileNames = [];
                    for (const e of smallFiles) {
                        fd.append('files', e.file, e.relativePath);
                        fileNames.push(e.relativePath);
                    }
                    fd.append('path', currentPath.value);
                    fd.append('fileNames', JSON.stringify(fileNames));
                    const smallTotal = smallFiles.reduce((s, e) => s + e.file.size, 0);
                    
                    const displayNames = fileNames.length === 1 ? fileNames[0] : `批量上传 ${fileNames.length} 个文件`;

                    await api.post('/api/files/upload', fd, {
                        signal: controller.signal,
                        onUploadProgress: (p) => {
                            if (p.total) {
                                updateProgress(p.loaded, displayNames);
                            }
                        }
                    });
                    uploadedSize += smallTotal;
                    lastTime = Date.now();
                    lastLoaded = uploadedSize;
                    store.task.processedSize = uploadedSize;
                }

                for (const entry of largeFiles) {
                    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                    await uploadFileWithChunk(entry.file, {
                        initUrl: '/api/files/chunk/init',
                        completeUrl: '/api/files/chunk/complete',
                        cancelUrl: '/api/files/chunk/cancel',
                        fileName: entry.relativePath,
                        extraInitData: { targetPath: currentPath.value },
                        signal: controller.signal,
                        onProgress: (bytesDone, bytesTotal, chunkNum, totalChunks) => {
                            updateProgress(bytesDone, entry.relativePath);
                        }
                    });
                    uploadedSize += entry.file.size;
                    lastTime = Date.now();
                    lastLoaded = uploadedSize;
                    store.task.processedSize = uploadedSize;
                }

                showToast($t('common.success')); loadFiles();
            } catch (e) {
                if (e.name === 'AbortError' || axios.isCancel(e) || e.message === 'canceled') {
                    showToast('已取消上传', 'warning');
                } else {
                    showToast($t('common.error'), 'danger');
                }
            } finally {
                setTimeout(() => store.task.visible = false, 500);
            }
        };

        const operateFiles = async (action, files, dest = '', extra = {}) => {
            const fullFiles = files.map(f => joinPath(currentPath.value, f));
            try {
                await api.post('/api/files/operate', { action, sources: fullFiles, destination: dest, ...extra });
                showToast($t('common.success')); loadFiles();
            } catch (e) { showToast($t('common.error'), 'danger'); }
        };

        const operateFilesWithProgress = async (action, files, dest = '', extra = {}) => {
            const fullFiles = files.map(f => joinPath(currentPath.value, f));
            const isCompressOrExtract = action === 'compress' || action === 'extract';
            const controller = new AbortController();
            
            if (isCompressOrExtract) {
                store.task.visible = true;
                store.task.title = action === 'compress' ? $t('files.compressing') : $t('files.extracting');
                store.task.percent = -1;
                store.task.processedSize = 0;
                store.task.totalSize = 0;
                store.task.fileName = files.length === 1 ? files[0] : `${files.length} 个文件`;
                store.task.speed = 0;
                store.task.canCancel = true;
                store.task.onCancel = () => {
                    controller.abort();
                };
            }
            try {
                await api.post('/api/files/operate', { action, sources: fullFiles, destination: dest, ...extra }, {
                    signal: controller.signal
                });
                showToast($t('common.success')); loadFiles();
            } catch (e) {
                if (e.name === 'AbortError' || axios.isCancel(e) || e.message === 'canceled') {
                    showToast('操作已取消', 'warning');
                } else {
                    showToast($t('common.error'), 'danger');
                }
            } finally {
                if (isCompressOrExtract) {
                    store.task.percent = 100;
                    setTimeout(() => { store.task.visible = false; }, 500);
                }
            }
        };

        const copyToClipboard = (action) => {
            clipboard.value = { action, files: [...selectedFiles.value], sourcePath: currentPath.value };
            showToast(t('files.clipboard_msg', { action: action === 'copy' ? t('files.copy') : t('files.move'), count: selectedFiles.value.length }));
            selectedFiles.value = [];
        };

        const pasteFiles = async () => {
            const sources = clipboard.value.files.map(f => joinPath(clipboard.value.sourcePath, f));
            try {
                await api.post('/api/files/operate', { action: clipboard.value.action, sources: sources, destination: currentPath.value });
                showToast($t('common.success')); loadFiles();
                if (clipboard.value.action === 'move') clipboard.value.files = [];
            } catch (e) { showToast($t('common.error'), 'danger'); }
        };

        const askCompress = () => {
            const defaultName = selectedFiles.value.length === 1 ? selectedFiles.value[0].split('.').shift() : 'archive';
            openModal({
                title: $t('files.modal_compress_title'), 
                message: $t('files.modal_compress_name'), 
                mode: 'input', 
                inputValue: defaultName,
                suffix: '.zip',
                placeholder: 'archive',
                callback: (name) => {
                    if (!name) return;
                    const finalName = name.endsWith('.zip') ? name : name + '.zip';
                    operateFilesWithProgress('compress', selectedFiles.value, currentPath.value, { compressName: finalName });
                }
            });
        };
        const askDelete = (files) => openModal({ title: $t('common.delete'), message: $t('common.delete_confirm', { count: files.length }), callback: () => operateFiles('delete', files) });

        const askNewFolder = () => openModal({
            title: $t('files.new_folder'), message: $t('files.modal_new_folder'), mode: 'input',
            callback: async (name) => {
                if (!name) return;
                try { await api.post('/api/files/mkdir', { path: joinPath(currentPath.value, name) }); showToast($t('common.success')); loadFiles(); }
                catch (e) { showToast($t('common.error'), 'danger'); }
            }
        });

        const askNewFile = () => openModal({
            title: $t('files.new_file'), message: $t('files.modal_new_file'), mode: 'input', placeholder: 'example.txt',
            callback: async (name) => {
                if (!name) return;
                try {
                    await api.post('/api/files/create', { path: joinPath(currentPath.value, name) });
                    showToast($t('common.success')); loadFiles();
                    editFile(name); // Auto open editor
                }
                catch (e) { showToast($t('common.error'), 'danger'); }
            }
        });

        const askRename = (file) => openModal({
            title: $t('common.rename'), message: $t('files.modal_rename'), mode: 'input', inputValue: file.name,
            callback: async (newName) => {
                if (!newName || newName === file.name) return;
                try {
                    await api.post('/api/files/rename', { oldPath: joinPath(currentPath.value, file.name), newPath: joinPath(currentPath.value, newName) });
                    showToast($t('common.success')); loadFiles();
                } catch (e) { showToast($t('common.error'), 'danger'); }
            }
        });

        const downloadFile = (name) => {
            const params = new URLSearchParams({ path: joinPath(currentPath.value, name) });
            if (store.currentInstanceId) params.set('instanceId', store.currentInstanceId);
            window.open(`/api/files/download?${params.toString()}`, '_blank');
        };

        const refreshFiles = async () => {
            if (isLoadingFiles.value) return;
            isLoadingFiles.value = true;
            try {
                await loadFiles(false);
            } finally {
                isLoadingFiles.value = false;
            }
        };
        const toggleActionMenu = (name) => {
            activeActionMenu.value = activeActionMenu.value === name ? null : name;
        };

        const handleDocClick = (e) => {
            if (activeActionMenu.value) {
                if (e && e.target && e.target.closest && e.target.closest('.file-more-btn')) {
                    return;
                }
                activeActionMenu.value = null;
            }
        };

        onMounted(() => {
            loadFiles();
            document.addEventListener('click', handleDocClick);
            document.addEventListener('touchstart', handleDocClick, { passive: true });
        });

        onUnmounted(() => {
            document.removeEventListener('click', handleDocClick);
            document.removeEventListener('touchstart', handleDocClick);
        });

        return {
            currentPath, pathParts, fileList, filteredFiles, selectedFiles, selectAll, searchQuery,
            editingFile, fileContent, hasUnsavedChanges, editorArea, clipboard, fileUp, folderUp, isDragging, dragCounter,
            previewingFile, previewType, previewData,
            isNavigating, isLoadingFiles,
            changeDir, goUp, joinPath, getIcon, formatSize, isArchive, isImageFile, extractFile, extractSelected, selectedArchiveFiles, handleDrop,
            uploadFiles, copyToClipboard, pasteFiles, askCompress, askDelete, downloadFile,
            editFile, saveFile, closeEditor, refreshFiles, askRename, askNewFile, askNewFolder,
            previewImage, previewArchive, closePreview,
            toggleActionMenu, activeActionMenu,
            uploadConfirmModal, checkedCount, hasAnySelectedFiles, confirmUploadFromModal,
            gutterArea, searchInputEl,
            editorSearchVisible, editorReplaceVisible, editorSearchQuery, editorReplaceQuery,
            searchMatchCase, searchMatchWord, searchMatches, currentMatchIndex,
            editorWrap, editorFontSize, editorFullscreen, cursorLine, cursorCol,
            mobileSymbols, editorLineCount,
            updateCursorPos, onEditorScroll, onFontSizeInput, validateFontSize, toggleSearch, closeSearch, onSearchInput,
            findNext, findPrev, replaceCurrent, replaceAll, formatContent, goToLine, goToLinePrompt, insertSymbol, handleEditorKeyDown
        };
    }
};