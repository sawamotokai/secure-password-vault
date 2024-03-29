const inquirer = require('inquirer')
const chalk = require('chalk')
inquirer.registerPrompt('search-list', require('inquirer-search-list'))
inquirer.registerPrompt(
  'checkbox-plus',
  require('inquirer-checkbox-plus-prompt'),
)

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

module.exports.verify_user = async db => {
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
        message: 'What is your master password?',
        type: 'password',
        mask: true,
        validate: input =>
          input === MASTER_PW
            ? true
            : chalk.red`Master password does not match.`,
      },
    ])
    pw = answer.pw
    if (pw === MASTER_PW) return true
    trial++
    console.log(chalk.red`Master password does not match.`)
  }
  return false
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
      .then(answer => {
        console.clear()
        return resolve(answer)
      })
      .catch(err => reject(err))
  })

module.exports.successMsg = msg => {
  console.log(chalk.greenBright(msg))
}

module.exports.infoMsg = msg => {
  console.log(chalk.cyan(msg))
}

module.exports.dangerMsg = msg => {
  console.log(chalk.red(msg))
}
