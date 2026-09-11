/**
 * 云语软件中心 Minecraft Web Panel - 插件系统 TypeScript 类型定义
 * CloudLanguage MC Web Panel - Plugin System TypeScript Definitions
 * 
 * @version 2.4.0
 */

import type { Server as SocketIOServer, Namespace as SocketIONamespace, Socket } from "socket.io";
import type { Router as ExpressRouter, Request, Response, NextFunction, RequestHandler } from "express";

export type SupportedLanguage = "zh" | "en";
export type LocalizedString = string | { [key in SupportedLanguage]?: string } | Record<string, string>;

export type KnownPermission =
    | "*"
    | "fs"
    | "fs.read"
    | "fs.write"
    | "file_system"
    | "network"
    | "process"
    | "socket"
    | "http"
    | "http.public"
    | "storage"
    | "settings"
    | "task"
    | "events"
    | "status"
    | "command"
    | "services";

export interface PluginManifest {
    id: string;
    name: LocalizedString;
    version: string;
    description?: LocalizedString;
    author?: string;
    icon?: string;
    color?: string;
    main?: string;
    defaultEnabled?: boolean;
    official?: boolean;
    permissions?: (KnownPermission | string)[];
    homepage?: string;
    license?: string;
    updateUrl?: string;
    updateCheckUrl?: string;
    dependencies?: Record<string, string>;
    pluginDependencies?: Record<string, string>;
    /** 系统注入的插件目录绝对路径 */
    _dir: string;
    /** 系统注入的当前启用状态 */
    _enabled: boolean;
    /** 系统注入的安装状态 */
    _installed: boolean;
}

export type FsScope = "plugin" | "data" | "instance" | "globalData";

export interface PluginFs {
    /**
     * 安全解析相对路径为绝对路径。若尝试通过 ../ 逃逸出指定的 scope 目录，将抛出安全异常。
     */
    resolveSafe(relPath: string, baseScope?: FsScope, instanceId?: string | null): string;

    /**
     * 安全读取文本文件
     */
    readText(relPath: string, baseScope?: FsScope, instanceId?: string | null, encoding?: BufferEncoding): Promise<string>;
    readTextSync(relPath: string, baseScope?: FsScope, instanceId?: string | null, encoding?: BufferEncoding): string;

    /**
     * 安全写入文本文件（支持原子写入机制，写入临时文件并重命名）
     */
    writeText(relPath: string, content: string, baseScope?: FsScope, instanceId?: string | null): Promise<boolean>;
    writeTextSync(relPath: string, content: string, baseScope?: FsScope, instanceId?: string | null): boolean;

    /**
     * 安全读取 JSON 文件
     */
    readJson<T = any>(relPath: string, baseScope?: FsScope, instanceId?: string | null): Promise<T>;
    readJsonSync<T = any>(relPath: string, baseScope?: FsScope, instanceId?: string | null): T;

    /**
     * 安全写入 JSON 文件（原子写入，格式化输出）
     */
    writeJson(relPath: string, data: any, baseScope?: FsScope, instanceId?: string | null, options?: { spaces?: number }): Promise<boolean>;
    writeJsonSync(relPath: string, data: any, baseScope?: FsScope, instanceId?: string | null, options?: { spaces?: number }): boolean;

    /**
     * 检查目标文件或目录是否存在
     */
    exists(relPath: string, baseScope?: FsScope, instanceId?: string | null): Promise<boolean>;
    existsSync(relPath: string, baseScope?: FsScope, instanceId?: string | null): boolean;

    /**
     * 确保目录存在，若不存在则递归创建
     */
    ensureDir(relPath: string, baseScope?: FsScope, instanceId?: string | null): Promise<string>;
    ensureDirSync(relPath: string, baseScope?: FsScope, instanceId?: string | null): string;

    /**
     * 列出目录中的文件及子目录
     */
    listDir(relPath?: string, baseScope?: FsScope, instanceId?: string | null): Promise<string[]>;

    /**
     * 安全删除文件或目录
     */
    remove(relPath: string, baseScope?: FsScope, instanceId?: string | null): Promise<boolean>;
}

export interface InstanceInfo {
    id: string;
    name: string;
    dir: string;
    loaderType?: string;
    jarName?: string;
    javaArgs?: string[];
    javaPath?: string;
    backupStrategy?: string;
    autoBackupEnabled?: boolean;
    autoBackupInterval?: number;
    maxBackupCount?: number;
    createdAt?: string;
    isRunning: boolean;
    onlinePlayers: string[];
    detectedVersion?: {
        mc: string;
        loader?: string;
    } | null;
}

export interface InstanceContextRequest extends Request {
    instanceId: string;
    instDir: string;
    instance: InstanceInfo;
    instState: {
        process: any | null;
        onlinePlayers: Set<string>;
        logHistory: string[];
        detectedVersion?: any;
    };
}

export interface InstancesManager {
    /** 获取所有实例信息及其运行状态 */
    list(): InstanceInfo[];
    /** 获取指定实例或当前活跃实例的信息 */
    get(instanceId?: string | null): InstanceInfo | null;
    /** 获取当前活跃的实例 ID */
    getActiveId(): string;
    /** 获取指定实例目录绝对路径 */
    getDir(instanceId?: string | null): string;
    /** Express 中间件：自动注入 req.instanceId, req.instDir, req.instance, req.instState */
    withInstance: RequestHandler;
}

export interface ServiceContainer {
    /** 注册公共能力服务，供其他插件调用 */
    register<T = any>(name: string, impl: T): void;
    /** 获取其他插件注册的服务，若不存在返回 null */
    get<T = any>(name: string): T | null;
    /** 检查服务是否已注册 */
    has(name: string): boolean;
}

export interface HttpRequestOptions {
    timeout?: number;
    headers?: Record<string, string>;
    params?: Record<string, any>;
    proxyGitHub?: boolean;
    responseType?: "json" | "text" | "arraybuffer" | "stream";
}

export interface PluginHttp {
    /** 若面板配置了 GitHub 代理，自动解析转换 URL */
    resolveGitHubUrl(url: string): string;
    /** 发送 GET 请求 */
    get<T = any>(url: string, options?: HttpRequestOptions): Promise<T>;
    /** 发送 POST 请求 */
    post<T = any>(url: string, data?: any, options?: HttpRequestOptions): Promise<T>;
}

export interface PluginStorage {
    get<T = any>(key?: string, defaultValue?: T): T;
    set(key: string, value: any): void;
    delete(key: string): void;
    has(key: string): boolean;
    keys(): string[];
    clear(): void;
    /** 立即异步/同步将内存数据写入磁盘（原子写入） */
    save(): void;
    flush(): void;
}

export type TaskStatus = "idle" | "running" | "stopping" | "stopped" | "completed" | "error" | "circuit_broken";

export interface TaskHandle {
    readonly name: string;
    readonly status: TaskStatus;
    start(...args: any[]): Promise<void>;
    stop(): void;
    restart(...args: any[]): Promise<void>;
    /** 重置熔断器状态 */
    resetCircuit(): void;
}

export interface TaskOptions {
    run: (signal: AbortSignal, ...args: any[]) => Promise<void> | void;
    autoStart?: boolean;
}

export type CronStatus = "idle" | "running" | "stopped" | "circuit_broken";

export interface CronHandle {
    readonly name: string;
    readonly status: CronStatus;
    readonly expression: string | number;
    readonly lastRun: Date | null;
    readonly runCount: number;
    start(): void;
    stop(): void;
    restart(): void;
    /** 重置熔断器状态 */
    resetCircuit(): void;
}

export interface CronOptions {
    autoStart?: boolean;
    immediate?: boolean;
}

export interface SidebarItemOptions {
    id: string;
    labelKey: string;
    icon: string;
    view: string;
    color?: string;
    location?: "instance" | "global" | "both";
}

export interface RouteOptions {
    /** 是否必须管理员角色 */
    requireAdmin?: boolean;
    /** 所需具体权限，例如 "instance.properties" */
    permission?: string;
}

export interface ServerLifecycleEvent {
    instanceId: string;
}

export interface ServerStopEvent extends ServerLifecycleEvent {
    code: number | null;
}

export interface PlayerLifecycleEvent extends ServerLifecycleEvent {
    player: string;
    onlinePlayers: string[];
}

export interface InstanceLifecycleEvent {
    instance: InstanceInfo | { id: string; name: string; dir: string; loaderType?: string };
}

export interface InstanceDeletedEvent {
    instanceId: string;
}

export interface PluginLogger {
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
}

export interface PluginSettingsSchema {
    fields?: Record<string, any>;
    defaults?: Record<string, any>;
}

export interface PluginSettingsHandle {
    get(key?: string): any;
    set(key: string, value: any): void;
    getAll(): Record<string, any>;
    reset(key?: string): void;
    getSchema(): PluginSettingsSchema;
}

export interface PluginApi {
    /** 插件唯一标识符 */
    readonly id: string;
    /** 插件清单元数据 */
    readonly manifest: PluginManifest;
    /** Socket.IO 根服务实例 */
    readonly io: SocketIOServer;
    /** 面板注入的运行时上下文 */
    readonly context: Record<string, any>;
    /** 插件 API 版本 */
    readonly version: string;

    /** 检查是否具有某项权限 */
    checkPermission(permission: string): boolean;

    /**
     * 注册私有受保护 HTTP 路由（自动经由鉴权中间件）
     * 访问路径：/api/plugins/[pluginId][prefix]
     */
    registerRoutes(prefix: string, setupFn: ExpressRouter | (() => ExpressRouter), options?: RouteOptions): void;

    /**
     * 注册公开无需登录的 HTTP 路由
     * 访问路径：/api/public/plugins/[pluginId][prefix]
     */
    registerPublicRoutes(prefix: string, setupFn: ExpressRouter | (() => ExpressRouter), options?: RouteOptions): void;

    /**
     * 注册 Socket.IO 命名空间及事件处理器
     * 命名空间：/plugin/[pluginId][namespace]
     */
    registerSocket(namespace: string, handlers: Record<string, (socket: Socket, ...args: any[]) => void>): SocketIONamespace;

    /** 注册面板前端侧边栏导航条目 */
    registerSidebarItem(item: SidebarItemOptions): void;

    /** 注册前端 Vue 组件文件路径 */
    registerComponent(name: string, componentPath: string): void;

    /** 注册首页/仪表盘概览卡片 */
    registerDashboardCard(name: string, componentName: string): void;

    /** 注册设置模型定义与默认值 */
    registerSettings(schema: PluginSettingsSchema): PluginSettingsHandle;

    /** 安全文件系统工具集（防目录穿越与原子写入保护） */
    readonly fs: PluginFs;

    /** 实例多环境管理与标准上下文中间件 */
    readonly instances: InstancesManager;

    /** 跨插件服务共享容器 */
    readonly services: ServiceContainer;

    /** 智能 HTTP 客户端（自动感知 GitHub 加速代理与超时保护） */
    readonly http: PluginHttp;

    /** 持久化键值存储 */
    readonly storage: PluginStorage;

    /** 原生生命周期事件：MC 服务器启动 */
    onServerStart(handler: (event: ServerLifecycleEvent) => void | Promise<void>): () => void;
    /** 原生生命周期事件：MC 服务器正常停止 */
    onServerStop(handler: (event: ServerStopEvent) => void | Promise<void>): () => void;
    /** 原生生命周期事件：MC 服务器异常崩溃 */
    onServerCrash(handler: (event: ServerStopEvent) => void | Promise<void>): () => void;
    /** 原生生命周期事件：玩家进入游戏 */
    onPlayerJoin(handler: (event: PlayerLifecycleEvent) => void | Promise<void>): () => void;
    /** 原生生命周期事件：玩家离开游戏 */
    onPlayerQuit(handler: (event: PlayerLifecycleEvent) => void | Promise<void>): () => void;
    /** 原生生命周期事件：新实例被创建 */
    onInstanceCreated(handler: (event: InstanceLifecycleEvent) => void | Promise<void>): () => void;
    /** 原生生命周期事件：实例被删除 */
    onInstanceDeleted(handler: (event: InstanceDeletedEvent) => void | Promise<void>): () => void;

    /** 向面板前端发送系统 Toast 通知 */
    notify(type: "success" | "info" | "warning" | "error", message: string, instanceId?: string | null): void;

    /** 向前端全量广播事件 */
    broadcast(event: string, data: any): void;

    /** 发送插件私有自定义事件 */
    emit(event: string, data: any): void;
    /** 监听所有插件的广播事件 */
    on(event: string, handler: (data: any, sourcePluginId: string) => void): () => void;
    /** 监听指定插件的事件 */
    onPlugin(sourcePluginId: string, event: string, handler: (data: any, sourcePluginId: string) => void): () => void;
    /** 单次监听事件 */
    once(event: string, handler: (data: any, sourcePluginId: string) => void): () => void;

    /** 上报插件状态 */
    reportStatus(status: Record<string, any>): void;

    /** 向指定实例发送控制台指令 */
    sendCommand(instanceId: string | null | undefined, command: string): boolean;

    /** 获取指定实例当前在线玩家列表 */
    getOnlinePlayers(instanceId?: string | null): string[];

    /** 监听所有或当前实例控制台标准输出日志 */
    onLog(handler: (instanceId: string, logLine: string) => void): () => void;

    /** 注册带熔断器保护的常驻后台任务 */
    registerTask(name: string, options: TaskOptions): TaskHandle;

    /** 注册带熔断器保护的定时任务 */
    registerCron(name: string, expression: string | number, handler: () => Promise<void> | void, options?: CronOptions): CronHandle;

    /** 插件日志器（自动附加插件名前缀） */
    readonly logger: PluginLogger;

    /** 获取插件私有数据目录 (plugins/[id]/data) */
    getDataDir(): string;
    /** 获取面板全局数据目录 (data/) */
    getGlobalDataDir(): string;
    /** 获取实例根目录 (instances/) */
    getInstancesDir(): string;
    /** 获取面板工作区基础目录 */
    getBaseDir(): string;
    /** 获取当前活跃实例 ID */
    getActiveInstanceId(): string;
    /** 获取指定实例绝对目录 */
    getInstanceDir(instanceId?: string | null): string;
    /** 获取面板运行配置 */
    getConfig(): Record<string, any>;
}

export type PluginDestroyFunction = () => Promise<void> | void;

export interface PluginInstance {
    destroy?: PluginDestroyFunction;
    [key: string]: any;
}

export type PluginFactory = (api: PluginApi) => Promise<PluginInstance | void> | PluginInstance | void;

export default PluginFactory;
