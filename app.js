const rl = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
})
const it = rl[Symbol.asyncIterator]()
const speakeasy = require('speakeasy')
const clipboardy = require('clipboardy')
// const { verify } = require('crypto');
const Database = require('sqlite-async')
const {
  promptAsync,
  generate_password,
  verify_user,
  verify_master_pw,
} = require('./utils')
const { exit } = require('process')

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
    console.log('\nWelcome! Your vault has been created!')
    console.log(
      '\nCreate master password! You are going to need this every time you login.',
    )
    console.log('Password:')
    let pw = await it.next()
    pw = pw.value
    query = `INSERT INTO Vault (service_name, account_id, password) VALUES ("vault", "admin", "${pw}")`
    await db.run(query)
    console.log('Master password has been created!')
  } catch (e) {
    await verify_user(db, it)
    let verified = false
    let row = await db.get(
      `SELECT * FROM Vault WHERE service_name="vault" AND account_id="2FA"`,
    )
    let two_factor_enabled = false
    // let two_factor_enabled = row !== undefined;
    if (two_factor_enabled) {
      let secret = row.password
      do {
        console.log('Enter 2FA: ')
        let two_factor = await it.next()
        two_factor = two_factor.value
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
        { name: 'Back to Home Menu', value: -1 },
        ...rows.map((row, i) => ({
          name: `Service: ${row.service_name}, ID: ${row.account_id}`,
          value: i,
        })),
      ],
    },
  ])
  let idx = await answer.idx
  try {
    if (idx === -1) return
    clipboardy.writeSync(rows[idx].password)
    console.log('Password saved to the clipboard!')
    return
  } catch (e) {
    console.error(e)
    return
  }
}

const gen_option = async db => {
  console.log('What is the name of the service?')
  let service_name = await it.next()
  service_name = service_name.value.toLowerCase()
  console.log('What is your account ID?')
  let account_id = await it.next()
  account_id = account_id.value

  let query = `SELECT * FROM Vault WHERE service_name="${service_name}" AND account_id="${account_id}"`
  let row = await db.get(query).catch(e => {
    console.error(e)
    console.log('Error in get query.')
  })

  if (row !== undefined) {
    console.log('You already have an account with that name')
    return
  }
  let password = generate_password()
  query = `INSERT INTO Vault (service_name, account_id, password) VALUES ("${service_name}", "${account_id}", "${password}")`
  await db.run(query).catch(e => {
    console.error(e)
    console.log('error in insert query.')
  })
  console.log(`\nYour Password => ${password}`)
  clipboardy.writeSync(password)
  console.log(`Copied to the clipboard!`)
  return
}

const sto_option = async db => {
  console.clear()
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
  query =
    row === undefined
      ? `INSERT INTO Vault (service_name, account_id, password) VALUES("${service_name}", "${account_id}", "${password}")`
      : `UPDATE Vault SET password="${password}" WHERE service_name="${service_name}" AND account_id="${account_id}"`
  await db.run(query).catch(err => {
    console.error(err)
    quit(db)
  })
  // TODO: use chalk here
  console.log('Your password has been saved!')
}

const del_option = async db => {
  let query = `SELECT * FROM Vault ORDER BY service_name`
  let rows = await db.all(query)
  if (rows.length === 0) {
    // if not found, back to option
    console.log(`No records were found.`)
    return
  }
  console.log(rows)
  let answer = await promptAsync([
    {
      type: 'checkbox-plus',
      name: 'indices',
      message: 'Which passwords do you want to delete?',
      pageSize: 10,
      searchable: true,
      source: (answersSoFar, input) => {
        input = input || ''
        return new Promise(function (resolve) {
          const data = rows.map((row, i) => ({
            name: `Service: ${row.service_name},   ID: ${row.account_id}`,
            value: i,
          }))
          resolve(data)
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
        console.log(c)
        let query = `DELETE FROM Vault WHERE ${c}`
        var success = true
        await db.run(query).catch(err => {
          console.error(err)
          console.log(
            `Password${
              indices.length === 1 ? '' : 's'
            } not deleted due to an error.`,
          )
          success = false
        })
        if (success)
          console.log(`Password${indices.length === 1 ? '' : 's'} deleted!`)
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
      await get_option(db)
      break
    case 2:
      await sto_option(db)
      break
    case 3:
      await gen_option(db)
      break
    case 4:
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
            name: 'Show Password',
            value: 1,
          },
          {
            name: 'Store Password',
            value: 2,
          },
          {
            name: 'Generate Password',
            value: 3,
          },
          {
            name: 'Delete Password',
            value: 4,
          },
          {
            name: 'Quit',
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
