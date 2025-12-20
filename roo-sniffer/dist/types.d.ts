import { IncomingMessage, ServerResponse } from 'http';
export interface SnifferConfig {
    port: number;
    logFile: string;
    watchDomains: string[];
    verbose: boolean;
    certDir: string;
}
export interface RequestLogEntry {
    timestamp: string;
    method: string;
    host: string;
    path: string;
    watched: boolean;
    bodyPreview?: string;
    headers?: Record<string, string | string[] | undefined>;
    statusCode?: number;
    responsePreview?: string;
}
export interface CertificateInfo {
    key: string;
    cert: string;
}
export interface ProxyRequest extends IncomingMessage {
    body?: Buffer;
}
export interface ProxyResponse extends ServerResponse {
    body?: Buffer;
}
export declare const DEFAULT_CONFIG: SnifferConfig;
//# sourceMappingURL=types.d.ts.map