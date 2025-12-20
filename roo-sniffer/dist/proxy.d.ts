import { SnifferConfig } from './types';
export declare class ProxyServer {
    private config;
    private server;
    private certManager;
    private logger;
    private webUI;
    private onRequest;
    constructor(config: SnifferConfig, uiPort?: number);
    private isWatchedDomain;
    private handleRequest;
    private handleConnect;
    private tunnelHttps;
    private interceptHttps;
    start(): Promise<void>;
    stop(): void;
}
//# sourceMappingURL=proxy.d.ts.map