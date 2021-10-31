const speakeasy = require('speakeasy')
const clipboardy = require('clipboardy')
const Database = require('sqlite-async')
const {
  promptAsync,
  generate_password,
  verify_user,
  successMsg,
  infoMsg,
  dangerMsg,
} = require('./utils')
const fuzzy = require('fuzzy')
const chalk = require('chalk')
const two_factor_enabled = process.env.ENABLE_2FA || false
// const inquirer = require('inquirer')
// const ui = new inquirer.ui.BottomBar()
// console.log(ui)
// outputStream.pipe(ui.log)

const init = async () => {
  const db = await Database.open('vault.db').catch(e => {
    console.error(e)
  })
  try {
    let query = `CREATE TABLE Vault (
          service_name VARCHAR(255) NOT NULL,
          account_id VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          note VARCHAR(1023),
          PRIMARY KEY (service_name, account_id)
        );`
    await db.run(query)
    successMsg('\nWelcome! Your vault has been created!')
    infoMsg(
      '\nCreate master password! You are going to need this every time you login.',
    )
    const answer = await promptAsync([
      {
        name: 'pw',
        type: 'input',
        message: 'Password:',
      },
    ])
    const { pw } = answer
    query = `INSERT INTO Vault (service_name, account_id, password) VALUES ("vault", "admin", "${pw}")`
    await db.run(query)
    successMsg('Master password has been created!')
  } catch (e) {
    await verify_user(db)
    let verified = false
    let row = await db.get(
      `SELECT * FROM Vault WHERE service_name="vault" AND account_id="2FA"`,
    )
    // let two_factor_enabled = row !== undefined;
    if (two_factor_enabled) {
      let secret = row.password
      do {
        const answer = await promptAsync([
          {
            name: 'two_factor',
            type: 'input',
            message: 'Enter 2FA:',
          },
        ])
        const { two_factor } = answer
        verified = speakeasy.totp.verify({
          secret: secret,
          encoding: 'ascii',
          token: two_factor,
        })
        if (two_factor.toLowerCase() === 'q') process.exit(1)
      } while (!verified)
    }
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
  const answer = await promptAsync([
    {
      type: 'search-list',
      message: 'Which vault do you want to open?',
      name: 'idx',
      choices: [
        ...rows.map((row, i) => ({
          name: `Service: ${row.service_name}, ID: ${row.account_id}`,
          value: i,
        })),
      ],
    },
  ])
  let idx = await answer.idx
  try {
    clipboardy.writeSync(rows[idx].password)
    infoMsg('Password saved to the clipboard!')
    return
  } catch (e) {
    console.error(e)
    return
  }
}

const gen_option = async db => {
  let answer = await promptAsync([
    {
      name: 'service_name',
      message: 'What is the name of the service?',
      type: 'input',
    },
  ])
  const service_name = answer.service_name.toUpperCase()
  answer = await promptAsync([
    {
      name: 'account_id',
      message: 'What is your account ID?',
      type: 'input',
    },
  ])
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
    `\nYour new password: ${chalk.italic(
      password,
    )} was copied to the clipboard!`,
  )
  clipboardy.writeSync(password)
}

const sto_option = async db => {
  let answer = await promptAsync([
    {
      name: 'service_name',
      message: 'What is the name of the service?',
      type: 'input',
    },
  ])
  const { service_name } = answer
  answer = await promptAsync([
    {
      name: 'account_id',
      message: 'What is your account ID?',
      type: 'input',
    },
  ])
  const { account_id } = answer
  answer = await promptAsync([
    {
      name: 'password',
      message: 'What is your password?',
      type: 'input',
    },
  ])
  const { password } = answer
  let query = `SELECT * FROM Vault WHERE service_name="${service_name}" AND account_id="${account_id}"`
  let row = await db.get(query, err => {
    console.error(err)
  })
  query = `INSERT INTO Vault (service_name, account_id, password) VALUES("${service_name}", "${account_id}", "${password}")`
  if (row === undefined) {
    const answer = await promptAsync([
      {
        name: 'yes',
        message:
          'You have a record for that service with the same account id. Do you want to overwrite the record?',
        type: 'confirm',
      },
    ])
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
  const data = rows.map((row, i) => ({
    name: `Service: ${row.service_name}\t\t\t\tID: ${row.account_id}`,
    value: i,
  }))
  let answer = await promptAsync([
    {
      type: 'checkbox-plus',
      name: 'indices',
      message: 'Which passwords do you want to delete?',
      pageSize: 10,
      searchable: true,
      source: (answersSoFar, input) => {
        input = input || ''
        return new Promise(resolve => {
          const fuzzyResult = fuzzy.filter(input, data, {
            extract: el => el.name,
          })
          const ret = fuzzyResult.map(element => {
            return element.original
          })
          resolve(ret)
        })
      },
    },
  ])
  const { indices } = answer
  if (indices.length === 0) return
  try {
    let conditions = indices.map(
      idx =>
        `(service_name="${rows[idx].service_name}" AND account_id="${rows[idx].account_id}")`,
    )
    if (await verify_user(db)) {
      let answer = await promptAsync([
        {
          name: 'yes',
          type: 'confirm',
          message: `Do you want to delete the selected item${
            indices.length === 1 ? '' : 's'
          }?`,
        },
      ])
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
    let answer = await promptAsync([
      {
        type: 'list',
        name: 'action',
        message: 'What do you want to do?',
        choices: [
          {
            name: chalk.blue`Show Password`,
            value: 1,
          },
          {
            name: chalk.green`Store Password`,
            value: 2,
          },
          {
            name: chalk.yellow`Generate Password`,
            value: 3,
          },
          {
            name: chalk.red`Delete Password`,
            value: 4,
          },
          {
            name: `Quit`,
            value: 0,
          },
        ],
      },
    ])
    const { action } = answer
    await run(db, action)
    answer = await promptAsync([
      {
        name: 'cont',
        type: 'confirm',
        message: 'Do you want to continue?',
      },
    ])
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
