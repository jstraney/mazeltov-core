const forge = require('node-forge');

const createCSRKeyPair = ( subject = [], attr = [] ) => {

  const keys = forge.pki.rsa.generateKeyPair(2048);

  const csr = forge.pki.createCertificationRequest();

  csr.publicKey = keys.publicKey;

  csr.setSubject(subject);

  if (attr.length) {
    csr.setAttributes(attr);
  }

  csr.sign(keys.privateKey, forge.md.sha256.create());

  const rsaPrivateKey = forge.pki.privateKeyToAsn1(keys.privateKey);
  const privateKeyInfo = forge.pki.wrapRsaPrivateKey(rsaPrivateKey);

  // return the private key and CSR in an array
  return [
    forge.pki.certificationRequestToPem(csr),
    forge.pki.privateKeyInfoToPem(privateKeyInfo),
  ];

};

module.exports = {
  createCSRKeyPair,
}
