

export const messages = {
    zh: {
        common: {
            cancel: '取消',
            confirm: '确认',
            execute: '执行',
            save: '保存',
            delete: '删除',
            edit: '编辑',
            search: '搜索',
            loading: '加载中...',
            success: '操作成功',
            error: '操作失败',
            yes: '是',
            no: '否',
            enabled: '已启用',
            disabled: '已禁用',
            unknown: '未知',
            actions: '操作',
            name: '名称',
            size: '大小',
            time: '时间',
            status: '状态',
            switchTheme: '切换主题',
            switchLang: 'Switch Language',
            logout: '退出登录',
            upload: '上传',
            download: '下载',
            refresh: '刷新',
            close: '关闭',
            add: '添加',
            remove: '移除',
            mode_gui: '图形模式',
            mode_text: '文本模式',
            player: '玩家',
            player_name: '玩家名称'
        },
        login: {
            title: 'MC 面板',
            prompt_scan: '请使用 Google Authenticator 扫描此二维码。',
            placeholder_code: '请输入 2FA 验证码',
            btn_verify: '验证身份',
            toast_fail: '验证码错误',
            toast_error: '请求失败'
        },
        sidebar: {
            title: 'MC 面板',
            dashboard: '控制台',
            settings: '服务器设置',
            mods: '模组管理',
            files: '文件管理',
            backups: '备份管理',
            auth: '认证管理',
            voicechat: '语音设置',
            players: '玩家管理'
        },
        dashboard: {
            console_title: '控制台',
            start: '启动服务器',
            stop: '停止服务器',
            state_running: '运行中',
            state_stopped: '已停止',
            server_info: 'MC 服务器信息',
            online_players: '在线人数',
            system_resource: '系统资源',
            cpu_usage: 'CPU 使用率',
            mem_usage: '内存',
            send_cmd_placeholder: '发送指令...',
            send: '发送',
            toast_sent: '已发送',
            system: '系统'
        },
        files: {
            path: '路径',
            operate: '批量操作',
            new_folder: '新建文件夹',
            new_file: '新建文件',
            upload_tips: '拖拽文件到这里上传',
            total: '共 {count} 项',
            move: '移动',
            copy: '复制',
            compress: '压缩',
            disable: '禁用',
            enable: '启用',
            modal_move_title: '移动/复制文件',
            modal_move_dest: '目标路径 (相对于根目录)',
            modal_compress_title: '压缩文件',
            modal_compress_name: '压缩包名称 (.zip)',
            modal_new_folder: '文件夹名称',
            modal_new_file: '文件名称'
        },
        mods: {
            title: '模组列表',
            upload_mod: '上传模组',
            upload_placeholder: '点击或拖拽上传 .jar 文件',
            search_placeholder: '搜索模组...',
            version: '版本',
            empty: '暂无模组'
        },
        players: {
            title: '玩家管理',
            online_players: '在线玩家',
            no_online: '当前没有玩家在线',
            whitelist: '白名单',
            ops: '管理员 (OP)',
            bans: '黑名单',
            kick: '踢出',
            ban: '封禁',
            teleport: '传送玩家',
            gamemode: '修改模式',
            clear_inv: '清空背包',
            kill: '击杀玩家'
        },
        backups: {
            create_snap: '创建快照',
            create_diff: '创建增量备份',
            restore: '还原',
            tips: '提示: 回档操作将先停止服务器，并自动为当前存档创建备份。',
            list_title: '备份列表',
            type_full: '全量',
            type_diff: '增量',
            confirm_restore_title: '确认回档',
            confirm_restore_msg: '确定要回档到 {name} 吗？服务器将先停止，当前存档会自动备份。',
            progress_restoring: '正在回档...',
            progress_unzipping: '解压中...',
            restore_success: '回档成功！'
        },
        easyauth: {
            users: '用户管理',
            registered: '已注册',
            unregistered: '未注册',
            password: '修改密码',
            unregister: '注销/删除',
            confirm_unregister: '确定要注销玩家'
        },
        voice: {
            title: '简单语音配置 (Simple Voice Chat)',
            general: '基础设置',
            port: '端口 (Port)',
            host: '语音主机 (Voice Host)',
            host_desc: '公网IP或域名，必须设置否则玩家无法连接',
            password: '连接密码',
            saved: '配置已保存 (需重启服务器)',
            restart_required: '修改配置后需要重启服务器才能生效。'
        },
        properties: {
            title: '服务器设置 (server.properties)',
            filter: '筛选设置...',
            restart_tips: '修改后需要重启服务器才能生效。',
            key: '键',
            value: '值'
        }
    },
    en: {
        common: {
            cancel: 'Cancel',
            confirm: 'Confirm',
            execute: 'Execute',
            save: 'Save',
            delete: 'Delete',
            edit: 'Edit',
            search: 'Search',
            loading: 'Loading...',
            success: 'Success',
            error: 'Failed',
            yes: 'Yes',
            no: 'No',
            enabled: 'Enabled',
            disabled: 'Disabled',
            unknown: 'Unknown',
            actions: 'Actions',
            name: 'Name',
            size: 'Size',
            time: 'Time',
            status: 'Status',
            switchTheme: 'Switch Theme',
            switchLang: '切换语言',
            logout: 'Logout',
            upload: 'Upload',
            download: 'Download',
            refresh: 'Refresh',
            close: 'Close',
            add: 'Add',
            remove: 'Remove',
            mode_gui: 'GUI Mode',
            mode_text: 'Text Mode',
            player: 'Player',
            player_name: 'Player Name'
        },
        login: {
            title: 'MC Panel',
            prompt_scan: 'Use Google Authenticator to scan this QR code.',
            placeholder_code: 'Enter 2FA Code',
            btn_verify: 'Verify Identity',
            toast_fail: 'Invalid Code',
            toast_error: 'Request Failed'
        },
        sidebar: {
            title: 'MC Panel',
            dashboard: 'Dashboard',
            settings: 'Settings',
            mods: 'Mods',
            files: 'Files',
            backups: 'Backups',
            auth: 'Auth',
            voicechat: 'Voice Chat',
            players: 'Players'
        },
        dashboard: {
            console_title: 'Console',
            start: 'Start Server',
            stop: 'Stop Server',
            state_running: 'Running',
            state_stopped: 'Stopped',
            server_info: 'Minecraft Server',
            online_players: 'Online Players',
            system_resource: 'System Load',
            cpu_usage: 'CPU Usage',
            mem_usage: 'Memory',
            send_cmd_placeholder: 'Send command...',
            send: 'Send',
            toast_sent: 'Command Sent',
            system: 'System'
        },
        files: {
            path: 'Path',
            operate: 'Batch Operation',
            new_folder: 'New Folder',
            new_file: 'New File',
            upload_tips: 'Drag & Drop files to upload',
            total: '{count} items',
            move: 'Move',
            copy: 'Copy',
            compress: 'Compress',
            disable: 'Disable',
            enable: 'Enable',
            modal_move_title: 'Move/Copy Files',
            modal_move_dest: 'Destination (relative to root)',
            modal_compress_title: 'Compress Files',
            modal_compress_name: 'Archive Name (.zip)',
            modal_new_folder: 'Folder Name',
            modal_new_file: 'File Name'
        },
        mods: {
            title: 'Mods List',
            upload_mod: 'Upload Mod',
            upload_placeholder: 'Click or Drag .jar files here',
            search_placeholder: 'Search mods...',
            version: 'Version',
            empty: 'No mods found'
        },
        players: {
            title: 'Player Manager',
            online_players: 'Online Players',
            no_online: 'No players online',
            whitelist: 'Whitelist',
            ops: 'Operators (OP)',
            bans: 'Banned Players',
            kick: 'Kick',
            ban: 'Ban',
            teleport: 'Teleport',
            gamemode: 'Gamemode',
            clear_inv: 'Clear Inv',
            kill: 'Kill'
        },
        backups: {
            create_snap: 'Create Snapshot',
            create_diff: 'Create Differential',
            restore: 'Restore',
            tips: 'Tip: Restore will stop the server and automatically backup current world.',
            list_title: 'Backup List',
            type_full: 'Full',
            type_diff: 'Diff',
            confirm_restore_title: 'Confirm Restore',
            confirm_restore_msg: 'Are you sure you want to restore {name}? Server will stop and current world will be backed up.',
            progress_restoring: 'Restoring...',
            progress_unzipping: 'Unzipping...',
            restore_success: 'Restore Completed!'
        },
        easyauth: {
            users: 'Users',
            registered: 'Registered',
            unregistered: 'Unregistered',
            password: 'Password',
            unregister: 'Unregister',
            confirm_unregister: 'Unregister player'
        },
        voice: {
            title: 'Simple Voice Chat',
            general: 'General',
            port: 'Port',
            host: 'Voice Host',
            host_desc: 'Public IP/Domain. Required.',
            password: 'Password',
            saved: 'Config Saved (Restart Required)',
            restart_required: 'Restart server to apply changes.'
        },
        properties: {
            title: 'Server Settings (server.properties)',
            filter: 'Filter settings...',
            restart_tips: 'Restart server to apply changes.',
            key: 'Key',
            value: 'Value'
        }
    }
};

export const createI18n = (store) => {
    return (key, params = {}) => {
        const keys = key.split('.');
        let value = messages[store.lang];
        for (const k of keys) {
            value = value?.[k]; // Use optional chaining to prevent crash
            if (!value) return key;
        }
        // Simple interpolation {name}
        if (typeof value === 'string') {
            return value.replace(/{(\w+)}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
        }
        return value;
    };
};
