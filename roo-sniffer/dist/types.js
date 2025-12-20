"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.DEFAULT_CONFIG = {
    port: 8080,
    logFile: 'roo_requests.log',
    watchDomains: [
        'anthropic',
        'openai',
        'api.roo',
        'amazonaws',
        'azure',
    ],
    verbose: true, // Enable by default to capture headers and response bodies
    certDir: '.roo-sniffer-certs',
};
//# sourceMappingURL=types.js.map