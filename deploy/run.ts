import SftpClient from "ssh2-sftp-client"
import * as fs from "fs"
import * as path from "path"

const config = {
    host: process.env.SFTP_HOST,
    port: Number(process.env.SFTP_PORT),
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD
} as const

const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry")
console.info(`DRY_RUN: ${DRY_RUN}`)
const env = Object.entries({
    SFTP_HOST: process.env.SFTP_HOST,
    SFTP_PORT: process.env.SFTP_PORT,
    SFTP_USERNAME: process.env.SFTP_USERNAME,
    SFTP_PASSWORD: process.env.SFTP_PASSWORD,
    DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK
})
const missing = env.filter(([, v]) => !v).map(([k]) => k)
if (missing.length > 0) {
    throw new Error(`Missing secrets/vars: ${missing.join(", ")}`)
}
if (DRY_RUN) {
    console.log("✅ All secrets & variables are set. Nothing was uploaded (dry-run).")
    process.exit(0)
}
const sftp = new SftpClient()

const distDir = "./packages/app/studio/dist"
const buildInfoPath = "./packages/app/studio/public/build-info.json"

const readBuildInfo = () => JSON.parse(fs.readFileSync(buildInfoPath, "utf8"))
const uploadDirectory = async (localDir: string, remoteDir: string) => {
        for (const file of fs.readdirSync(localDir)) {
            const localPath = path.join(localDir, file)
            const remotePath = path.posix.join(remoteDir, file)
            const stat = fs.lstatSync(localPath)
            if (stat.isDirectory()) {
                await sftp.mkdir(remotePath, true).catch(() => {})
                await uploadDirectory(localPath, remotePath)
            } else {
                console.log("upload", remotePath)
                await sftp.put(localPath, remotePath)
            }
        }
    }

;(async () => {
    await sftp.connect(config)

    const {uuid} = readBuildInfo()
    const releaseDir = `/releases/${uuid}`
    console.log("creating", releaseDir)
    await sftp.mkdir(releaseDir, true).catch(() => {})

    console.log("uploading dist...")
    await uploadDirectory(distDir, releaseDir)

    const htaccess = [
        "RewriteEngine On",
        `RewriteRule ^(.*)$ ${releaseDir}/$1 [L]`,
        ""
    ].join("\n")

    const localTmp = "./.htaccess-test"
    fs.writeFileSync(localTmp, htaccess)
    await sftp.put(localTmp, "/.htaccess-test")
    fs.unlinkSync(localTmp)

    await sftp.end()
    console.log("✅ Test release uploaded to", releaseDir)
    console.log("ℹ️  To activate: rename /.htaccess-test → /.htaccess")
})()
