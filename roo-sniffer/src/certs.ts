import * as forge from 'node-forge';
import * as fs from 'fs';
import * as path from 'path';
import { CertificateInfo } from './types';

const CA_CERT_NAME = 'roo-sniffer-ca';

export class CertificateManager {
  private certDir: string;
  private caCert: forge.pki.Certificate | null = null;
  private caKey: forge.pki.rsa.PrivateKey | null = null;
  private certCache: Map<string, CertificateInfo> = new Map();

  constructor(certDir: string) {
    this.certDir = certDir;
    this.ensureCertDir();
    this.loadOrCreateCA();
  }

  private ensureCertDir(): void {
    if (!fs.existsSync(this.certDir)) {
      fs.mkdirSync(this.certDir, { recursive: true });
    }
  }

  private loadOrCreateCA(): void {
    const caCertPath = path.join(this.certDir, `${CA_CERT_NAME}.pem`);
    const caKeyPath = path.join(this.certDir, `${CA_CERT_NAME}-key.pem`);

    if (fs.existsSync(caCertPath) && fs.existsSync(caKeyPath)) {
      // Load existing CA
      const certPem = fs.readFileSync(caCertPath, 'utf8');
      const keyPem = fs.readFileSync(caKeyPath, 'utf8');
      this.caCert = forge.pki.certificateFromPem(certPem);
      this.caKey = forge.pki.privateKeyFromPem(keyPem);
      console.log('📜 Loaded existing CA certificate');
    } else {
      // Generate new CA
      this.generateCA();
      console.log('📜 Generated new CA certificate');
      console.log(`   Install it from: ${caCertPath}`);
    }
  }

  private generateCA(): void {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [
      { name: 'commonName', value: 'Roo Sniffer CA' },
      { name: 'organizationName', value: 'Roo Sniffer' },
      { name: 'countryName', value: 'US' },
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: true,
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        cRLSign: true,
      },
      {
        name: 'subjectKeyIdentifier',
      },
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());

    this.caCert = cert;
    this.caKey = keys.privateKey;

    // Save CA certificate and key
    const caCertPath = path.join(this.certDir, `${CA_CERT_NAME}.pem`);
    const caKeyPath = path.join(this.certDir, `${CA_CERT_NAME}-key.pem`);

    fs.writeFileSync(caCertPath, forge.pki.certificateToPem(cert));
    fs.writeFileSync(caKeyPath, forge.pki.privateKeyToPem(keys.privateKey));
  }

  public getCertificateForHost(hostname: string): CertificateInfo {
    // Check cache first
    const cached = this.certCache.get(hostname);
    if (cached) {
      return cached;
    }

    // Generate new certificate for this host
    const certInfo = this.generateHostCertificate(hostname);
    this.certCache.set(hostname, certInfo);
    return certInfo;
  }

  private generateHostCertificate(hostname: string): CertificateInfo {
    if (!this.caCert || !this.caKey) {
      throw new Error('CA certificate not initialized');
    }

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = Date.now().toString(16);
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [
      { name: 'commonName', value: hostname },
      { name: 'organizationName', value: 'Roo Sniffer' },
    ];

    cert.setSubject(attrs);
    cert.setIssuer(this.caCert.subject.attributes);

    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false,
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: hostname }, // DNS
        ],
      },
    ]);

    cert.sign(this.caKey, forge.md.sha256.create());

    return {
      key: forge.pki.privateKeyToPem(keys.privateKey),
      cert: forge.pki.certificateToPem(cert),
    };
  }

  public getCACertPath(): string {
    return path.join(this.certDir, `${CA_CERT_NAME}.pem`);
  }
}
