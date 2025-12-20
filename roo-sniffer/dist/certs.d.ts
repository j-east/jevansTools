import { CertificateInfo } from './types';
export declare class CertificateManager {
    private certDir;
    private caCert;
    private caKey;
    private certCache;
    constructor(certDir: string);
    private ensureCertDir;
    private loadOrCreateCA;
    private generateCA;
    getCertificateForHost(hostname: string): CertificateInfo;
    private generateHostCertificate;
    getCACertPath(): string;
}
//# sourceMappingURL=certs.d.ts.map