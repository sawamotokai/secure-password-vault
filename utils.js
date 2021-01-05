module.exports.generate_password = () => {
    let generator = require('generate-password');
    let password = generator.generate({
        length: process.env.PW_LENGTH || 50,
        numbers: true,
        symbols: true,
        strict: true,
        exclude: "\"",
    });
    return password;
}

module.exports.verify_user = async (db, it) => {
  console.log("Enter the master password: ");
  let master_pw = await it.next();
  let query = `SELECT * FROM Vault WHERE service_name="vault" AND account_id="admin"`;
  let admin_info = await db.get(query);
  let MASTER_PW = admin_info.password;
  while (master_pw.value !== MASTER_PW) {
      if (master_pw.value === "q") process.exit(1);
      console.log("Enter the master password: ");
      master_pw = await it.next();
  }
  if (master_pw.value !== MASTER_PW) {
      process.exit(1);
  }
}

module.exports.verify_master_pw = async (db, master_pw) => {
    let row = await db.get(`SELECT * FROM Vault WHERE service_name="vault" AND account_id="admin"`);
    return row && row.password === master_pw;
}