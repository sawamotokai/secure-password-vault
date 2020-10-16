const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
const it = rl[Symbol.asyncIterator]();
require('dotenv').config();
const Database = require('sqlite-async');


const generate_password = () => {
    let generator = require('generate-password');
    let password = generator.generate({
        length: 50,
        numbers: true,
        symbols: true,
        strict: true,
    });
    return password;
}

const main = async () => {
    // Master Login
    console.log("Enter the master password: ");
    let master_pw = await it.next();
    while (master_pw.value != process.env.MASTER_PW) {
        if (master_pw.value === "q") break;
        console.log("Enter the master password: ");
        master_pw = await it.next();
    }
    if (master_pw.value !== process.env.MASTER_PW) {
        process.exit(1);
    }

    const db = await Database.open("vault.db").catch(e=>{console.error(e)});

    try {
      let query = `CREATE TABLE Vault (
          service_name VARCHAR(255) NOT NULL,
          account_id VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          note VARCHAR(1023),
          PRIMARY KEY (service_name, account_id)
        );`;
      await db.run(query);
      console.log("Welcome! Your vault has been created!\nWhat would you like to do?");
    } catch (e) {
      console.log("Welcome! Your vault has been loaded!\nWhat would you like to do?");
    }

    while (1) {
        console.log("\n***********************************");
        console.log("q   : Quit");
        console.log("get : Get Password");
        console.log("gall: Get All Passwords");
        console.log("gen : Generate New Password");
        console.log("set : Set Password");
        console.log("***********************************");
        let menu = await it.next();
        menu = menu.value;
        if (menu === 'q') break;
        if (menu === 'get') {
            console.log("What is the name of the service?"); 
            let service_name = await it.next();
            service_name = service_name.value
            console.log("What is the name of your acocunt?");
            let account_id = await it.next();
            account_id = account_id.value

            let query = `SELECT * FROM Vault 
                          WHERE service_name="${service_name}" AND account_id="${account_id}"`;
            let rows = await db.all(query);
            if (rows.length === 0) { // if not found, back to menu
                console.log(`No keys were found.`);
                continue;
            }
            console.log("*********************************");
            for (let row of rows) {
                console.log(`ID: ${row.account_id}`);
                console.log(`Password: ${row.password}\n`);
            }
            console.log("***********************************\n");
            continue;
        }
        // if (menu === 'gall') {
        //     // let passwords = query
        //     for (let pw of passwords) {
        //         console.log(Service: ${service});
        //         console.log(Password: ${pw}\n);
        //     }
        //     continue;
        // }
        if (menu === 'gen') {
            console.log("What is the name of the service?");
            let service_name = await it.next();
            service_name = service_name.value;
            console.log("What is your account ID?")
            let account_id = await it.next();
            account_id = account_id.value;

            let query = `SELECT * FROM Vault WHERE service_name="${service_name}" AND account_id="${account_id}"`;
            let row = await db.get(query).catch(e=>{console.error(e)});
            if (row !== undefined) {
                console.log("You already have an account with that name");
                continue;
            }
            let password = generate_password();
            query = `INSERT INTO Vault (service_name, account_id, password) VALUES ("${service_name}", "${account_id}", "${password}")`;
            await db.run(query).catch(e=>{console.error(e)});
            console.log(password);
            continue;
        }
    }
    db.close();
    console.log("Bye!")
    process.exit(1);
}
main();