const speakeasy = require('speakeasy')
const qrcode = require('qrcode-terminal')
const Database = require('sqlite-async')
const { verify_user, promptAsync, successMsg } = require('./utils')

const main = async () => {
  const db = await Database.open('vault.db').catch(e => {
    console.error(e)
  })
  try {
    await verify_user(db)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
  let secret = speakeasy.generateSecret({ name: 'Vault' })
  qrcode.generate(secret.otpauth_url, { small: true })
  console.log(
    '******************************************************************************************************',
  )
  console.log(
    '* Please Scan the QR code from a mobile app such as Microsoft Authenticator or Google Authenticator! *',
  )
  console.log(
    '******************************************************************************************************',
  )
  let verified = false
  do {
    const answer = await promptAsync([
      {
        name: 'two_factor',
        message: 'Enter 2FA: ',
        type: 'input',
      },
    ])
    const { two_factor } = answer
    verified = speakeasy.totp.verify({
      secret: secret.ascii,
      encoding: 'ascii',
      token: two_factor,
    })
    if (two_factor.toLowerCase() === 'q') process.exit(1)
  } while (!verified)
  await db.run(
    `INSERT INTO Vault (service_name, account_id, password) VALUES ("vault","2FA","${secret.ascii}")`,
  )
  successMsg('2FA has been configured!')
  process.exit(1)
}

main()
