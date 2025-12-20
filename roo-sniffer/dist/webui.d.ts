import { RequestLogEntry, SnifferConfig } from './types';
export declare class WebUI {
    private server;
    private config;
    private requests;
    private discoveredDomains;
    private clients;
    private uiPort;
    private runningProcesses;
    constructor(config: SnifferConfig, uiPort?: number);
    addRequest(entry: RequestLogEntry): void;
    private broadcast;
    updateConfig(newConfig: Partial<SnifferConfig>): void;
    getConfig(): SnifferConfig;
    private handleRequest;
    private handleSSE;
    private handleGetRequests;
    private handleGetConfig;
    private handleUpdateConfig;
    private handleGetDomains;
    private handleClear;
    private handleLaunch;
    private handleGetProcesses;
    private serveHTML;
    start(): void;
    stop(): void;
}
//# sourceMappingURL=webui.d.ts.map