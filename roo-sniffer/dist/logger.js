"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const fs = __importStar(require("fs"));
const chalk_1 = __importDefault(require("chalk"));
class Logger {
    logStream;
    config;
    constructor(config) {
        this.config = config;
        this.logStream = fs.createWriteStream(config.logFile, { flags: 'a' });
    }
    logRequest(entry) {
        const flag = entry.watched ? chalk_1.default.yellow('⚠️  ') : '   ';
        const method = this.colorMethod(entry.method);
        const host = entry.watched ? chalk_1.default.yellow(entry.host) : chalk_1.default.gray(entry.host);
        const path = chalk_1.default.cyan(entry.path);
        console.log(`${flag}${method} ${host}${path}`);
        if (this.config.verbose && entry.headers) {
            console.log(chalk_1.default.gray('   Headers:'), JSON.stringify(entry.headers, null, 2));
        }
        if (entry.bodyPreview) {
            console.log(chalk_1.default.gray('   Body preview:'), entry.bodyPreview.substring(0, 200));
        }
        // Write to log file
        this.logStream.write(JSON.stringify(entry) + '\n');
    }
    logResponse(entry) {
        if (entry.statusCode) {
            const statusColor = this.getStatusColor(entry.statusCode);
            console.log(chalk_1.default.gray('   ← ') +
                statusColor(`${entry.statusCode}`) +
                (entry.responsePreview ? chalk_1.default.gray(` (${entry.responsePreview.length} bytes)`) : ''));
        }
    }
    colorMethod(method) {
        switch (method.toUpperCase()) {
            case 'GET':
                return chalk_1.default.green(method.padEnd(6));
            case 'POST':
                return chalk_1.default.blue(method.padEnd(6));
            case 'PUT':
                return chalk_1.default.yellow(method.padEnd(6));
            case 'DELETE':
                return chalk_1.default.red(method.padEnd(6));
            case 'PATCH':
                return chalk_1.default.magenta(method.padEnd(6));
            case 'CONNECT':
                return chalk_1.default.cyan(method.padEnd(6));
            default:
                return chalk_1.default.white(method.padEnd(6));
        }
    }
    getStatusColor(status) {
        if (status >= 200 && status < 300) {
            return chalk_1.default.green;
        }
        else if (status >= 300 && status < 400) {
            return chalk_1.default.yellow;
        }
        else if (status >= 400 && status < 500) {
            return chalk_1.default.red;
        }
        else if (status >= 500) {
            return chalk_1.default.bgRed.white;
        }
        return chalk_1.default.white;
    }
    info(message) {
        console.log(chalk_1.default.blue('ℹ️  ') + message);
    }
    success(message) {
        console.log(chalk_1.default.green('✅ ') + message);
    }
    warn(message) {
        console.log(chalk_1.default.yellow('⚠️  ') + message);
    }
    error(message) {
        console.log(chalk_1.default.red('❌ ') + message);
    }
    close() {
        this.logStream.end();
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map