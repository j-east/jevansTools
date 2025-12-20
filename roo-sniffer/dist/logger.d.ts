import { RequestLogEntry, SnifferConfig } from './types';
export declare class Logger {
    private logStream;
    private config;
    constructor(config: SnifferConfig);
    logRequest(entry: RequestLogEntry): void;
    logResponse(entry: RequestLogEntry): void;
    private colorMethod;
    private getStatusColor;
    info(message: string): void;
    success(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    close(): void;
}
//# sourceMappingURL=logger.d.ts.map