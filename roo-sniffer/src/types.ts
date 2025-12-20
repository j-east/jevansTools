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

export const DEFAULT_CONFIG: SnifferConfig = {
  port: 8080,
  logFile: 'roo_requests.log',
  watchDomains: [
    'anthropic',
    'openai',
    'api.roo',
    'amazonaws',
    'azure',
  ],
  verbose: true,  // Enable by default to capture headers and response bodies
  certDir: '.roo-sniffer-certs',
};
