const speakeasy = require('speakeasy');
const qrcode = require('qrcode-terminal');
const Database = require('sqlite-async');

let secret = speakeasy.generateSecret({name: "Vault"});
console.log(secret);
qrcode.generate(secret.otpauth_url, { small: true });
