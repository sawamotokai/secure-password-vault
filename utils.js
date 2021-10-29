const inquirer = require('inquirer')
inquirer.registerPrompt('search-list', require('inquirer-search-list'))

module.exports.generate_password = () => {
  let generator = require('generate-password')
  let password = generator.generate({
    length: process.env.PW_LENGTH || 30,
    numbers: true,
    symbols: true,
    strict: true,
    exclude: '"',
  })
  return password
}

module.exports.verify_user = async (db, it) => {
  let pw = ''
  let query = `SELECT * FROM Vault WHERE service_name="vault" AND account_id="admin"`
  let admin_info = await db.get(query)
  let MASTER_PW = admin_info.password
  let trial = 0
  while (pw !== MASTER_PW && trial < 5) {
    if (pw === 'q') process.exit(1)
    const answer = await this.promptAsync([
      {
        name: 'pw',
        message: 'What is your password?',
        type: 'password',
        mask: true,
      },
    ])
    pw = answer.pw
    if (pw === MASTER_PW) return
    trial++
  }
  console.log('User not verified. Exiting...')
  process.exit(1)
}

module.exports.verify_master_pw = async (db, master_pw) => {
  let row = await db.get(
    `SELECT * FROM Vault WHERE service_name="vault" AND account_id="admin"`,
  )
  return row && row.password === master_pw
}

module.exports.promptAsync = ([question]) =>
  new Promise((resolve, reject) => {
    inquirer
      .prompt(question)
      .then(answer => resolve(answer))
      .catch(err => reject(err))
  })
