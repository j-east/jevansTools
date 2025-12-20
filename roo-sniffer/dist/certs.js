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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateManager = void 0;
const forge = __importStar(require("node-forge"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CA_CERT_NAME = 'roo-sniffer-ca';
class CertificateManager {
    certDir;
    caCert = null;
    caKey = null;
    certCache = new Map();
    constructor(certDir) {
        this.certDir = certDir;
        this.ensureCertDir();
        this.loadOrCreateCA();
    }
    ensureCertDir() {
        if (!fs.existsSync(this.certDir)) {
            fs.mkdirSync(this.certDir, { recursive: true });
        }
    }
    loadOrCreateCA() {
        const caCertPath = path.join(this.certDir, `${CA_CERT_NAME}.pem`);
        const caKeyPath = path.join(this.certDir, `${CA_CERT_NAME}-key.pem`);
        if (fs.existsSync(caCertPath) && fs.existsSync(caKeyPath)) {
            // Load existing CA
            const certPem = fs.readFileSync(caCertPath, 'utf8');
            const keyPem = fs.readFileSync(caKeyPath, 'utf8');
            this.caCert = forge.pki.certificateFromPem(certPem);
            this.caKey = forge.pki.privateKeyFromPem(keyPem);
            console.log('📜 Loaded existing CA certificate');
        }
        else {
            // Generate new CA
            this.generateCA();
            console.log('📜 Generated new CA certificate');
            console.log(`   Install it from: ${caCertPath}`);
        }
    }
    generateCA() {
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
    getCertificateForHost(hostname) {
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
    generateHostCertificate(hostname) {
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
    getCACertPath() {
        return path.join(this.certDir, `${CA_CERT_NAME}.pem`);
    }
}
exports.CertificateManager = CertificateManager;
//# sourceMappingURL=certs.js.map