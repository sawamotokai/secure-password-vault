module.exports.generate_password = () => {
    let generator = require('generate-password');
    let password = generator.generate({
        length: process.env.PW_LENGTH | 50,
        numbers: true,
        symbols: true,
        strict: true,
    });
    return password;
}