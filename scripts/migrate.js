/* eslint-disable camelcase */
/* eslint-disable new-cap */
/* eslint-disable no-multi-str */
/* eslint-disable no-template-curly-in-string */

require("dotenv").config()

const settings = require("../migrations/witnet.settings")
const utils = require("./utils")

if (process.argv.length < 3) {
  console.log()
  console.log("\n\
    Usage: yarn migrate <[Realm.]Network>\n\
       or: npm run migrate <[Realm.]Network>\n\n\
  ")
  process.exit(0)
}

const rn = utils.getRealmNetworkFromString(process.argv[2])
const realm = rn[0]; const network = rn[1]

if (!settings.networks[realm] || !settings.networks[realm][network]) {
  console.error(`\n!!! Network "${network}" not found.\n`)
  if (settings.networks[realm]) {
    console.error(`> Available networks in realm "${realm}":`)
    console.error(settings.networks[realm])
  } else {
    console.error("> Available networks:")
    console.error(settings.networks)
  }
  process.exit(1)
}

migrate(network)

/// ///////////////////////////////////////////////////////////////////////////////

async function migrate(network) {
  
  const backupRequired = checkIfBackupRequired(network);
  if (backupRequired) {
    console.log("> Backup is recommended before proceeding with migration.");
    const proceed = await promptUserForBackup();
    if (!proceed) {
      console.log("> Migration aborted by user.");
      process.exit(0);
    }
  }

  console.log(`> Migrating into "${realm}:${network}"...`)

  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      await runMigration(network);
      break;
    } catch (error) {
      console.error(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt >= maxRetries) {
        console.error("> Max retries reached. Migration failed.");
        process.exit(1);
      }
      console.log("> Retrying migration...");
    }
  }
}

function checkIfBackupRequired(network) {
  const testNetworks = ['rinkeby', 'ropsten', 'kovan'];
  return !testNetworks.includes(network.toLowerCase());
}

function promptUserForBackup() {
  return new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      "Do you want to proceed without a backup? (yes/no): ",
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      }
    );
  });
}
function runMigration(network) {
  return new Promise((resolve, reject) => {
    const subprocess = require("child_process").spawn(
      "npx truffle",
      [
        "migrate",
        "--reset",
        "--network",
        network,
      ],
      {
        shell: true,
        stdin: "inherit",
      }
    );
    
    subprocess.stdout.pipe(process.stdout);
    subprocess.stderr.pipe(process.stderr);

    subprocess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Migration failed with exit code ${code}`));
      }
      resolve();
    });
  });
}
