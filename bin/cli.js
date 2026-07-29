#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_DIR = path.join(__dirname, '..');
const CONFIG_FILE = path.join(BASE_DIR, 'data', 'config.json');
const INSTANCES_FILE = path.join(BASE_DIR, 'data', 'instances.json');

// Ensure config exists
if (!fs.existsSync(CONFIG_FILE)) {
    console.error('🔴 面板配置文件不存在，请确保面板已运行过一次并成功启动。');
    process.exit(1);
}

let config = {};
try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
} catch (e) {
    console.error('🔴 读取面板配置失败:', e.message);
    process.exit(1);
}

const cliSecret = config.cliSecret;
const port = config.port || 3000;
const apiBase = `http://localhost:${port}/api`;

if (!cliSecret) {
    console.error('🔴 面板 cliSecret 未配置，请重新启动面板以自动生成。');
    process.exit(1);
}

// Setup Axios headers
const client = axios.create({
    headers: {
        'x-cli-secret': cliSecret
    }
});

const printUsage = () => {
    console.log(`
☘️  MC Web Panel 命令行管理工具 (CLI Helper)

使用格式:
  agy-cli <command> [arguments]

可用指令:
  list, ls                           列出所有实例及运行状态
  status <instance_id_or_name>      获取特定实例的当前状态
  start <instance_id_or_name>       启动指定实例
  stop <instance_id_or_name>        安全停止指定实例
  force-stop <instance_id_or_name>   强制停止 (SIGKILL) 实例
  cmd <instance_id_or_name> <cmd>    向服务器控制台发送指令

示例:
  agy-cli ls
  agy-cli start survival
  agy-cli cmd survival "say Hello Server!"
`);
};

// Help helper
const args = process.argv.slice(2);
if (args.length === 0 || ['--help', '-h', 'help'].includes(args[0])) {
    printUsage();
    process.exit(0);
}

const command = args[0];

const findInstanceId = (query) => {
    if (!fs.existsSync(INSTANCES_FILE)) {
        return query; // fallback
    }
    try {
        const data = JSON.parse(fs.readFileSync(INSTANCES_FILE, 'utf-8'));
        const list = data.instances || [];
        const match = list.find(i => i.id === query || i.name === query);
        return match ? match.id : query;
    } catch (e) {
        return query;
    }
};

const handleList = async () => {
    try {
        const res = await client.get(`${apiBase}/instances/list`);
        const list = res.data.instances || res.data;
        if (!list || list.length === 0) {
            console.log('⚠️ 没有注册的 Minecraft 实例。');
            return;
        }

        console.log('\n⚙️  Minecraft 运行实例列表:');
        console.log('----------------------------------------------------');
        console.log(`${'ID'.padEnd(10)} | ${'名称'.padEnd(15)} | ${'状态'.padEnd(8)} | ${'在线人数'}`);
        console.log('----------------------------------------------------');
        for (const inst of list) {
            const status = inst.isRunning ? '🟢 运行中' : '🔴 已停止';
            const players = inst.isRunning ? `${inst.onlinePlayers || 0}人` : '-';
            console.log(`${inst.id.padEnd(10)} | ${inst.name.padEnd(15)} | ${status.padEnd(8)} | ${players}`);
        }
        console.log('----------------------------------------------------\n');
    } catch (e) {
        console.error('🔴 获取实例列表失败:', e.response?.data?.error || e.message);
    }
};

const handleStart = async (query) => {
    const instanceId = findInstanceId(query);
    console.log(`⏳ 正在尝试启动实例: ${query} (ID: ${instanceId})...`);
    try {
        const res = await client.post(`${apiBase}/server/start`, { instanceId });
        if (res.data && res.data.success === false) {
            console.error(`🔴 启动失败: ${res.data.message}`);
        } else {
            console.log(`🟢 启动指令已成功发出！`);
        }
    } catch (e) {
        console.error('🔴 启动失败:', e.response?.data?.error || e.message);
    }
};

const handleStop = async (query) => {
    const instanceId = findInstanceId(query);
    console.log(`⏳ 正在发送安全停止指令: ${query} (ID: ${instanceId})...`);
    try {
        await client.post(`${apiBase}/server/stop`, { instanceId });
        console.log(`🟢 停止指令已成功发出。`);
    } catch (e) {
        console.error('🔴 停止失败:', e.response?.data?.error || e.message);
    }
};

const handleForceStop = async (query) => {
    const instanceId = findInstanceId(query);
    console.log(`⏳ 正在发送强杀指令: ${query} (ID: ${instanceId})...`);
    try {
        await client.post(`${apiBase}/server/force_stop`, { instanceId });
        console.log(`🟢 实例进程已被强行杀死。`);
    } catch (e) {
        console.error('🔴 强制停止失败:', e.response?.data?.error || e.message);
    }
};

const handleCmd = async (query, cmd) => {
    if (!cmd) {
        console.error('🔴 错误: 请指定要发送的指令参数。');
        printUsage();
        process.exit(1);
    }
    const instanceId = findInstanceId(query);
    try {
        await client.post(`${apiBase}/server/command`, { instanceId, command: cmd });
        console.log(`🟢 指令已发送: "${cmd}"`);
    } catch (e) {
        console.error('🔴 指令发送失败:', e.response?.data?.error || e.message);
    }
};

const handleStatus = async (query) => {
    const instanceId = findInstanceId(query);
    try {
        const res = await client.get(`${apiBase}/instances/list`);
        const list = res.data.instances || res.data;
        const inst = list.find(i => i.id === instanceId);
        if (!inst) {
            console.error('🔴 错误: 实例未找到。');
            return;
        }
        console.log(`\n🔍 实例 [${inst.name}] 详情:`);
        console.log(`  - 实例ID: ${inst.id}`);
        console.log(`  - 状态: ${inst.isRunning ? '🟢 运行中' : '🔴 已停止'}`);
        if (inst.isRunning) {
            console.log(`  - 在线人数: ${inst.onlinePlayers || 0} 人`);
        }
        console.log(`  - 加载器类型: ${inst.loaderType || '未知'}`);
        console.log(`  - JAR文件名: ${inst.jarName || '未指定'}`);
        console.log('');
    } catch (e) {
        console.error('🔴 获取实例状态失败:', e.response?.data?.error || e.message);
    }
};

(async () => {
    switch (command) {
        case 'list':
        case 'ls':
            await handleList();
            break;
        case 'start':
            if (!args[1]) { console.error('🔴 请指定实例名称或ID'); process.exit(1); }
            await handleStart(args[1]);
            break;
        case 'stop':
            if (!args[1]) { console.error('🔴 请指定实例名称或ID'); process.exit(1); }
            await handleStop(args[1]);
            break;
        case 'force-stop':
            if (!args[1]) { console.error('🔴 请指定实例名称或ID'); process.exit(1); }
            await handleForceStop(args[1]);
            break;
        case 'cmd':
            if (!args[1]) { console.error('🔴 请指定实例名称或ID'); process.exit(1); }
            await handleCmd(args[1], args[2]);
            break;
        case 'status':
            if (!args[1]) { console.error('🔴 请指定实例名称或ID'); process.exit(1); }
            await handleStatus(args[1]);
            break;
        default:
            console.error(`🔴 未知指令: ${command}`);
            printUsage();
            process.exit(1);
    }
})();
