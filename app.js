const speakeasy = require('speakeasy')
const clipboardy = require('clipboardy')
const Database = require('sqlite-async')
const chalk = require('chalk')
const {
  get_option_inquiries,
  gen_option_inquiries,
  sto_option_inquiries,
  del_option_inquiries,
  main_inquiries,
  init_inquiries,
} = require('./inquiries')
const {
  promptAsync,
  generate_password,
  verify_user,
  successMsg,
  infoMsg,
  dangerMsg,
} = require('./utils')
// const inquirer = require('inquirer')
// const ui = new inquirer.ui.BottomBar()
// console.log(ui)
// outputStream.pipe(ui.log)

const two_factor_enabled = process.env.ENABLE_2FA || false
var db

const init = async () => {
  db = await Database.open('vault.db').catch(e => console.error(e))
  try {
    let query = `CREATE TABLE IF NOT EXISTS Vault (
          service_name VARCHAR(255) NOT NULL,
          account_id VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          note VARCHAR(1023),
          PRIMARY KEY (service_name, account_id)
        );`
    await db.run(query)
    successMsg('Welcome!')
    infoMsg(
      '\nCreate master password! You are going to need this every time you login.',
    )
    let row = await db.get(
      `SELECT * FROM Vault WHERE service_name="vault" AND account_id="admin"`,
    )
    if (row) {
      if (!(await verify_user(db))) quit(db)
    } else {
      while (1) {
        let answer = await promptAsync(init_inquiries.password)
        var { pw } = answer
        answer = await promptAsync(init_inquiries.confirmPassword(pw))
        var { pw2 } = answer
        if (pw !== pw2) console.log(chalk.red`>> Password does not match!`)
        else break
      }
      query = `INSERT INTO Vault (service_name, account_id, password) VALUES ("vault", "admin", "${pw}")`
      await db.run(query)
      successMsg('Master password has been created!')
    }

    let verified = false
    row = await db.get(
      `SELECT * FROM Vault WHERE service_name="vault" AND account_id="2FA"`,
    )
    if (row.length === 0 && two_factor_enabled) {
      let secret = row.password
      do {
        const answer = await promptAsync(init_inquiries.twoFactor)
        const { two_factor } = answer
        verified = speakeasy.totp.verify({
          secret: secret,
          encoding: 'ascii',
          token: two_factor,
        })
        if (two_factor.toLowerCase() === 'q') process.exit(1)
      } while (!verified)
    }
  } catch (e) {
    console.error(e)
  }
  return db
}

const get_option = async db => {
  let query = `SELECT * FROM Vault ORDER BY service_name`
  let rows = await db.all(query)
  if (rows.length === 0) {
    // if not found, back to option
    console.log(`No vaults were found.`)
    return
  }
  const answer = await promptAsync(get_option_inquiries.vault(rows))
  let idx = await answer.idx
  try {
    const password = rows[idx].password
    clipboardy.writeSync(password)
    infoMsg(
      `Your password: ${chalk.italic(
        password,
      )} has been copied to the clipboard!`,
    )
    return
  } catch (e) {
    console.error(e)
    return
  }
}

const gen_option = async db => {
  let answer = await promptAsync(gen_option_inquiries.srvName)
  const service_name = answer.service_name.toUpperCase()
  answer = await promptAsync(gen_option_inquiries.accountId)
  const { account_id } = answer
  let query = `SELECT * FROM Vault WHERE service_name="${service_name}" AND account_id="${account_id}"`
  let row = await db.get(query).catch(e => {
    console.error(e)
    dangerMsg('Error in get query.')
  })
  if (row !== undefined) {
    dangerMsg('You already have an account with that name')
    return
  }
  const password = generate_password()
  query = `INSERT INTO Vault (service_name, account_id, password) VALUES ("${service_name}", "${account_id}", "${password}")`
  await db.run(query).catch(e => {
    console.error(e)
    dangerMsg('error in insert query.')
  })
  successMsg('Password created!')
  infoMsg(
    `Your new password: ${chalk.italic(
      password,
    )} has been copied to the clipboard!`,
  )
  clipboardy.writeSync(password)
}

const sto_option = async db => {
  let answer = await promptAsync(sto_option_inquiries.srvName)
  const { service_name } = answer
  answer = await promptAsync(sto_option_inquiries.accountId)
  const { account_id } = answer
  answer = await promptAsync(sto_option_inquiries.password)
  const { password } = answer
  let query = `SELECT * FROM Vault WHERE service_name="${service_name}" AND account_id="${account_id}"`
  let row = await db.get(query, err => {
    console.error(err)
  })
  query = `INSERT INTO Vault (service_name, account_id, password) VALUES("${service_name}", "${account_id}", "${password}")`
  if (row !== undefined) {
    const answer = await promptAsync(sto_option_inquiries.confirm)
    const { yes } = answer
    if (!yes) return
    query = `UPDATE Vault SET password="${password}" WHERE service_name="${service_name}" AND account_id="${account_id}"`
  }
  await db.run(query).catch(err => {
    console.error(err)
    quit(db)
  })
  successMsg('Your password has been saved!')
}

const del_option = async db => {
  let query = `SELECT * FROM Vault ORDER BY service_name`
  let rows = await db.all(query)
  if (rows.length === 0) {
    // if not found, back to option
    dangerMsg(`No records were found.`)
    return
  }
  const data = rows
    .filter(row => row.service_name !== 'vault')
    .map((row, i) => ({
      name: `Service: ${row.service_name}\t\t\tID: ${row.account_id}`,
      value: i,
    }))
  let answer = await promptAsync(del_option_inquiries.indices(data))
  const { indices } = answer
  if (indices.length === 0) return
  try {
    let conditions = indices.map(
      idx =>
        `(service_name="${rows[idx].service_name}" AND account_id="${rows[idx].account_id}")`,
    )
    if (await verify_user(db)) {
      let answer = await promptAsync(del_option_inquiries.confirm)
      const { yes } = answer
      if (yes) {
        let c = conditions.join(' OR ')
        let query = `DELETE FROM Vault WHERE ${c}`
        var success = true
        await db.run(query).catch(err => {
          console.error(err)
          dangerMsg(
            `Password${
              indices.length === 1 ? '' : 's'
            } not deleted due to an error.`,
          )
          success = false
        })
        if (success)
          dangerMsg(`Password${indices.length === 1 ? '' : 's'} deleted!`)
      }
    }
  } catch (e) {
    console.error(e)
  }
}

const run = async (db, action) => {
  console.clear()
  switch (action) {
    case 0:
      quit(db)
    case 1:
      //   ui.log.write(chalk.bgBlue`SHOW`)
      await get_option(db)
      break
    case 2:
      //   ui.log.write(chalk.bgGreen`STORE`)
      await sto_option(db)
      break
    case 3:
      //   ui.log.write(chalk.bgYellow`GENERATE`)
      await gen_option(db)
      break
    case 4:
      //   ui.log.write(chalk.bgRed`DELETE`)
      await del_option(db)
      break
  }
}

const main = async () => {
  // Master Login
  const db = await init()
  while (1) {
    console.clear()
    let answer = await promptAsync(main_inquiries.action)
    const { action } = answer
    await run(db, action)
    answer = await promptAsync(main_inquiries.confirm)
    const { cont } = answer
    if (!cont) quit(db)
  }
}

const quit = db => {
  db.close()
  console.log('Bye!')
  process.exit(1)
}

main()
