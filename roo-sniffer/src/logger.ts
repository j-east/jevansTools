import * as fs from 'fs';
import chalk from 'chalk';
import { RequestLogEntry, SnifferConfig } from './types';

export class Logger {
  private logStream: fs.WriteStream;
  private config: SnifferConfig;

  constructor(config: SnifferConfig) {
    this.config = config;
    this.logStream = fs.createWriteStream(config.logFile, { flags: 'a' });
  }

  public logRequest(entry: RequestLogEntry): void {
    const flag = entry.watched ? chalk.yellow('⚠️  ') : '   ';
    const method = this.colorMethod(entry.method);
    const host = entry.watched ? chalk.yellow(entry.host) : chalk.gray(entry.host);
    const path = chalk.cyan(entry.path);

    console.log(`${flag}${method} ${host}${path}`);

    if (this.config.verbose && entry.headers) {
      console.log(chalk.gray('   Headers:'), JSON.stringify(entry.headers, null, 2));
    }

    if (entry.bodyPreview) {
      console.log(chalk.gray('   Body preview:'), entry.bodyPreview.substring(0, 200));
    }

    // Write to log file
    this.logStream.write(JSON.stringify(entry) + '\n');
  }

  public logResponse(entry: RequestLogEntry): void {
    if (entry.statusCode) {
      const statusColor = this.getStatusColor(entry.statusCode);
      console.log(
        chalk.gray('   ← ') + 
        statusColor(`${entry.statusCode}`) +
        (entry.responsePreview ? chalk.gray(` (${entry.responsePreview.length} bytes)`) : '')
      );
    }
  }

  private colorMethod(method: string): string {
    switch (method.toUpperCase()) {
      case 'GET':
        return chalk.green(method.padEnd(6));
      case 'POST':
        return chalk.blue(method.padEnd(6));
      case 'PUT':
        return chalk.yellow(method.padEnd(6));
      case 'DELETE':
        return chalk.red(method.padEnd(6));
      case 'PATCH':
        return chalk.magenta(method.padEnd(6));
      case 'CONNECT':
        return chalk.cyan(method.padEnd(6));
      default:
        return chalk.white(method.padEnd(6));
    }
  }

  private getStatusColor(status: number): (text: string) => string {
    if (status >= 200 && status < 300) {
      return chalk.green;
    } else if (status >= 300 && status < 400) {
      return chalk.yellow;
    } else if (status >= 400 && status < 500) {
      return chalk.red;
    } else if (status >= 500) {
      return chalk.bgRed.white;
    }
    return chalk.white;
  }

  public info(message: string): void {
    console.log(chalk.blue('ℹ️  ') + message);
  }

  public success(message: string): void {
    console.log(chalk.green('✅ ') + message);
  }

  public warn(message: string): void {
    console.log(chalk.yellow('⚠️  ') + message);
  }

  public error(message: string): void {
    console.log(chalk.red('❌ ') + message);
  }

  public close(): void {
    this.logStream.end();
  }
}
