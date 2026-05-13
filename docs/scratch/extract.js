const fs = require('fs');
const path = require('path');

const i18nFile = '/home/henvei/文档/云语软件中心相关开发/mc-web-panel/public/js/i18n.js';
const guideFile = '/home/henvei/文档/云语软件中心相关开发/mc-web-panel/public/js/components/PluginDevGuide.js';

// 模拟简单的 $t
function getI18n() {
    const content = fs.readFileSync(i18nFile, 'utf8');
    // 简单粗暴的提取，因为 i18n.js 结构比较整齐
    const zhMatch = content.match(/zh: \{([\s\S]+?)\},\s+en:/);
    const enMatch = content.match(/en: \{([\s\S]+?)\}\s+\};/);
    
    // 这里我们直接定义一些关键的，因为正则表达式解析复杂的嵌套对象不靠谱
    // 实际上我们可以通过 eval 或者真正的解析器，但为了脚本简单，我们手动映射
    return {
        zh: {
            'plugins.guide_step1_title': '快速创建',
            'plugins.guide_step1_desc': '创建一个包含 plugin.json 的文件夹即可开始。',
            'plugins.manifest': 'plugin.json 清单参考',
            'plugins.dependencies': 'NPM 依赖管理',
            'plugins.backend': '后端开发与 API 参考',
            'plugins.frontend': '前端开发指南',
            'plugins.vue-options': 'Vue 组件选项与内置组件',
            'plugins.i18n': '国际化 (i18n)',
            'plugins.socket': 'Socket.IO 实战',
            'plugins.lifecycle': '插件生命周期',
            'plugins.panel-api': '内置 API 服务',
            'plugins.css': 'CSS 样式类参考',
            'plugins.tips': '开发技巧'
        },
        en: {
            'plugins.guide_step1_title': 'Quick Start',
            'plugins.guide_step1_desc': 'Create a folder with plugin.json to start.',
            'plugins.manifest': 'plugin.json Reference',
            'plugins.dependencies': 'NPM Dependencies',
            'plugins.backend': 'Backend & API Reference',
            'plugins.frontend': 'Frontend Guide',
            'plugins.vue-options': 'Vue Options & Components',
            'plugins.i18n': 'Internationalization (i18n)',
            'plugins.socket': 'Socket.IO Communication',
            'plugins.lifecycle': 'Plugin Lifecycle',
            'plugins.panel-api': 'Built-in API',
            'plugins.css': 'CSS & Variables',
            'plugins.tips': 'Dev Tips'
        }
    };
}

const messages = getI18n();

function processTemplate(html, lang) {
    // 1. 处理 v-if/v-else
    // 简单策略：保留指定语言的块，删掉另一种语言的块
    if (lang === 'zh') {
        html = html.replace(/<p v-else[\s\S]+?<\/p>/g, '');
        html = html.replace(/<ul v-else[\s\S]+?<\/ul>/g, '');
        html = html.replace(/<template v-else>[\s\S]+?<\/template>/g, '');
        html = html.replace(/<div v-else[\s\S]+?<\/div>/g, '');
        
        // 保留 zh 块
        html = html.replace(/<p v-if="store.lang === 'zh'"[^>]*>([\s\S]+?)<\/p>/g, '<p class="text-muted mb-4 lh-lg">$1</p>');
        html = html.replace(/<ul v-if="store.lang === 'zh'"[^>]*>([\s\S]+?)<\/ul>/g, '<ul class="small text-muted mb-0 ps-3 lh-lg">$1</ul>');
        html = html.replace(/<template v-if="store.lang === 'zh'">([\s\S]+?)<\/template>/g, '$1');
    } else {
        html = html.replace(/<p v-if="store.lang === 'zh'"[\s\S]+?<\/p>/g, '');
        html = html.replace(/<ul v-if="store.lang === 'zh'"[\s\S]+?<\/ul>/g, '');
        html = html.replace(/<template v-if="store.lang === 'zh'">[\s\S]+?<\/template>/g, '');
        
        // 保留 en 块 (v-else)
        html = html.replace(/<p v-else[^>]*>([\s\S]+?)<\/p>/g, '<p class="text-muted mb-4 lh-lg">$1</p>');
        html = html.replace(/<ul v-else[^>]*>([\s\S]+?)<\/ul>/g, '<ul class="small text-muted mb-0 ps-3 lh-lg">$1</ul>');
        html = html.replace(/<template v-else>([\s\S]+?)<\/template>/g, '$1');
    }

    // 2. 处理 {{ $t('...') }}
    html = html.replace(/\{\{\s*\$t\(['"](.+?)['"]\)\s*\}\}/g, (match, key) => {
        return messages[lang][key] || key;
    });

    // 3. 处理 {{ store.lang === "zh" ? "..." : "..." }}
    html = html.replace(/\{\{\s*store\.lang\s*===\s*["']zh["']\s*\?\s*["']([\s\S]+?)["']\s*:\s*["']([\s\S]+?)["']\s*\}\}/g, (match, zh, en) => {
        return lang === 'zh' ? zh : en;
    });

    // 4. 清理残留的 Vue 属性
    html = html.replace(/v-pre/g, '');
    
    return html.trim();
}

const rawContent = fs.readFileSync(guideFile, 'utf8');
const sections = [];
const sectionRegex = /<section id="section-(.+?)"[\s\S]+?<\/section>/g;
let match;

while ((match = sectionRegex.exec(rawContent)) !== null) {
    const id = match[1];
    const fullHtml = match[0];
    
    // 提取图标和标题
    const iconMatch = fullHtml.match(/<i class="fa-(?:solid|brands) (.+?)"/);
    const icon = iconMatch ? iconMatch[1] : 'fa-puzzle-piece';
    
    sections.push({
        id,
        icon: icon.startsWith('fa-') ? icon : 'fa-' + icon,
        zh: processTemplate(fullHtml, 'zh'),
        en: processTemplate(fullHtml, 'en')
    });
}

// 映射标题和描述（基于提取后的 HTML 结构）
const finalData = { zh: { sections: [] }, en: { sections: [] } };

sections.forEach(s => {
    // 提取标题
    const zhTitleMatch = s.zh.match(/<h3[^>]*>([\s\S]+?)<\/h3>/);
    const zhDescMatch = s.zh.match(/<p class="text-muted small[^>]*>([\s\S]+?)<\/p>/);
    
    const enTitleMatch = s.en.match(/<h3[^>]*>([\s\S]+?)<\/h3>/);
    const enDescMatch = s.en.match(/<p class="text-muted small[^>]*>([\s\S]+?)<\/p>/);

    // 清理 HTML 标签
    const clean = (str) => str ? str.replace(/<[^>]+>/g, '').trim() : '';

    finalData.zh.sections.push({
        id: s.id,
        icon: s.icon,
        title: clean(zhTitleMatch ? zhTitleMatch[1] : ''),
        description: clean(zhDescMatch ? zhDescMatch[1] : ''),
        content: s.zh.replace(/<div class="d-flex align-items-center mb-4">[\s\S]+?<\/div>\s*<\/div>/, '').trim() // 移除标题头
    });

    finalData.en.sections.push({
        id: s.id,
        icon: s.icon,
        title: clean(enTitleMatch ? enTitleMatch[1] : ''),
        description: clean(enDescMatch ? enDescMatch[1] : ''),
        content: s.en.replace(/<div class="d-flex align-items-center mb-4">[\s\S]+?<\/div>\s*<\/div>/, '').trim()
    });
});

const output = `const docContentData = ${JSON.stringify(finalData, null, 4)};`;
fs.writeFileSync('/home/henvei/文档/云语软件中心相关开发/mc-web-panel/plugin-dev-doc/js/content.js', output);
console.log('Extraction complete!');
