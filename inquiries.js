const chalk = require('chalk')
const fuzzy = require('fuzzy')

module.exports.get_option_inquiries = {
  vault: rows => [
    {
      type: 'search-list',
      message: 'Which vault do you want to open?',
      name: 'idx',
      choices: rows.map((row, i) => ({
        name: `Service: ${row.service_name}\t\t\t ID: ${row.account_id}`,
        value: i,
      })),
    },
  ],
}

module.exports.gen_option_inquiries = {
  srvName: [
    {
      name: 'service_name',
      message: 'What is the name of the service?',
      type: 'input',
    },
  ],
  accountId: [
    {
      name: 'account_id',
      message: 'What is your account ID?',
      type: 'input',
    },
  ],
}

module.exports.sto_option_inquiries = {
  srvName: [
    {
      name: 'service_name',
      message: 'What is the name of the service?',
      type: 'input',
    },
  ],
  accountId: [
    {
      name: 'account_id',
      message: 'What is your account ID?',
      type: 'input',
    },
  ],
  password: [
    {
      name: 'password',
      message: 'What is your password?',
      type: 'input',
    },
  ],
  confirm: [
    {
      name: 'yes',
      message: `${chalk.underline`You have a record for that service with the same account id.`} Do you want to overwrite the record?`,
      type: 'confirm',
    },
  ],
}

module.exports.del_option_inquiries = {
  indices: data => [
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
  ],
  confirm: [
    {
      name: 'yes',
      type: 'confirm',
      message: `Do you want to delete the selected item(s)?`,
    },
  ],
}

module.exports.main_inquiries = {
  action: [
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
  ],
  confirm: [
    {
      name: 'cont',
      type: 'confirm',
      message: 'Do you want to continue?',
    },
  ],
}

module.exports.init_inquiries = {
  password: [
    {
      name: 'pw',
      type: 'input',
      message: 'Password:',
    },
  ],
}
